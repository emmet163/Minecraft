using System;
using Stonewake.World;

namespace Stonewake.Survival;

public enum GameMode { Survival, Creative }
public enum DamageKind { Fall, Drowning, Suffocation, Cold, Heat, Starvation, Lightning }

public sealed record SurvivalSave(float Health, float Hunger, float Saturation, float Oxygen,
    int Experience, GameMode Mode, CellKey? BedSpawn, BlockType CreativeBlock);

// Pure gameplay rules; world queries and presentation stay in Main.
public sealed class SurvivalState
{
    public const float MaxHealth = 20;
    public const float MaxHunger = 20;
    public const float MaxOxygen = 10;
    public float Health { get; private set; } = MaxHealth;
    public float Hunger { get; private set; } = MaxHunger;
    public float Saturation { get; private set; } = 5;
    public float Oxygen { get; private set; } = MaxOxygen;
    public int Experience { get; private set; }
    public GameMode Mode { get; private set; } = GameMode.Survival;
    public CellKey? BedSpawn { get; private set; }
    public BlockType CreativeBlock { get; private set; } = BlockType.Stone;
    public bool IsDead => Health <= 0;
    public int Level
    {
        get
        {
            var points = Experience; var level = 0;
            while (points >= 10 + level * 5) { points -= 10 + level * 5; level++; }
            return level;
        }
    }
    public float ExperienceFraction
    {
        get
        {
            var points = Experience;
            for (var level = 0; ; level++)
            {
                var required = 10 + level * 5;
                if (points < required) return points / (float)required;
                points -= required;
            }
        }
    }
    private float _hungerClock;
    private float _healClock;
    private float _damageClock;
    private float _oxygenClock;
    private float _exposureClock;
    private float _healDelay;

    public void SetMode(GameMode mode)
    {
        Mode = mode;
        if (mode == GameMode.Creative) { Health = MaxHealth; Oxygen = MaxOxygen; }
    }
    public void SelectCreativeBlock(BlockType block)
    {
        if (block != BlockType.Air && block is not (BlockType.GrassSide or BlockType.SnowSide)) CreativeBlock = block;
    }
    public void SetBedSpawn(CellKey? cell) => BedSpawn = cell;
    public void AddExperience(int points) => Experience = Math.Max(0, Experience + points);
    public bool Damage(float amount, DamageKind kind)
    {
        if (Mode == GameMode.Creative || IsDead || amount <= 0) return false;
        Health = Math.Max(0, Health - amount);
        _healClock = 0;
        _healDelay = 8;
        return true;
    }
    public void Heal(float amount)
    {
        if (IsDead || amount <= 0) return;
        Health = Math.Min(MaxHealth, Health + amount);
    }
    public bool Eat(int nutrition, float saturation, float healing = 0)
    {
        if (Mode == GameMode.Creative || IsDead || nutrition <= 0 && healing <= 0) return false;
        if (Hunger >= MaxHunger && Health >= MaxHealth) return false;
        Hunger = Math.Min(MaxHunger, Hunger + nutrition);
        Saturation = Math.Min(Hunger, Saturation + saturation);
        Heal(healing);
        return true;
    }
    public void Tick(float seconds, bool sprinting, bool underwater, bool suffocating, bool cold, bool hot)
    {
        if (seconds <= 0 || IsDead || Mode == GameMode.Creative) return;
        _healDelay = Math.Max(0, _healDelay - seconds);
        _hungerClock += seconds * (sprinting ? 2f : 1f);
        while (_hungerClock >= 45)
        {
            _hungerClock -= 45;
            if (Saturation > 0) Saturation = Math.Max(0, Saturation - 1);
            else Hunger = Math.Max(0, Hunger - 1);
        }
        if (underwater)
        {
            Oxygen = Math.Max(0, Oxygen - seconds);
            _oxygenClock += seconds;
            if (Oxygen <= 0 && _oxygenClock >= 1) { _oxygenClock = 0; Damage(1, DamageKind.Drowning); }
        }
        else { Oxygen = Math.Min(MaxOxygen, Oxygen + seconds * 3); _oxygenClock = 0; }
        if (suffocating || Hunger <= 0)
        {
            _damageClock += seconds;
            if (_damageClock >= (suffocating ? 1 : 4))
            {
                _damageClock = 0;
                Damage(suffocating ? 1.5f : 1, suffocating ? DamageKind.Suffocation : DamageKind.Starvation);
            }
        }
        else _damageClock = 0;
        if (cold || hot)
        {
            _exposureClock += seconds;
            if (_exposureClock >= 15)
            {
                _exposureClock = 0;
                Damage(1, cold ? DamageKind.Cold : DamageKind.Heat);
            }
        }
        else _exposureClock = 0;
        if (_healDelay <= 0 && Hunger >= 18 && Health < MaxHealth && !underwater && !suffocating)
        {
            _healClock += seconds;
            if (_healClock >= 6) { _healClock = 0; Heal(1); Saturation = Math.Max(0, Saturation - .5f); }
        }
        else _healClock = 0;
    }
    public void Respawn()
    {
        Health = MaxHealth; Hunger = 18; Saturation = 5; Oxygen = MaxOxygen;
        Experience /= 2;
        _hungerClock = _healClock = _damageClock = _oxygenClock = _exposureClock = _healDelay = 0;
    }
    public SurvivalSave Snapshot() => new(Health, Hunger, Saturation, Oxygen, Experience, Mode, BedSpawn, CreativeBlock);
    public void Load(SurvivalSave? save)
    {
        if (save == null) { Reset(); return; }
        Health = Math.Clamp(save.Health, 0, MaxHealth);
        Hunger = Math.Clamp(save.Hunger, 0, MaxHunger);
        Saturation = Math.Clamp(save.Saturation, 0, Hunger);
        Oxygen = Math.Clamp(save.Oxygen, 0, MaxOxygen);
        Experience = Math.Max(0, save.Experience);
        Mode = Enum.IsDefined(save.Mode) ? save.Mode : GameMode.Survival;
        BedSpawn = save.BedSpawn;
        CreativeBlock = save.CreativeBlock == BlockType.Air ? BlockType.Stone : save.CreativeBlock;
        _hungerClock = _healClock = _damageClock = _oxygenClock = _exposureClock = _healDelay = 0;
    }
    public void Reset() => Load(new SurvivalSave(MaxHealth, MaxHunger, 5, MaxOxygen, 0, GameMode.Survival, null, BlockType.Stone));
}
