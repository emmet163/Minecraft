using System;
using System.IO;
using System.Linq;
using Godot;
using Stonewake.Game;
using Stonewake.Items;
using Stonewake.Player;
using Stonewake.Survival;
using Stonewake.UI;
using Stonewake.World;

namespace Stonewake.Tests;

public partial class SurvivalProbe : Node
{
    public override async void _Ready()
    {
        const int seed = 56231498;
        var editsPath = ProjectSettings.GlobalizePath("user://phase5_probe_edits.json");
        var itemsPath = ProjectSettings.GlobalizePath("user://phase5_probe_items.json");
        try
        {
            if (File.Exists(editsPath)) File.Delete(editsPath);
            if (File.Exists(itemsPath)) File.Delete(itemsPath);
            var game = new Main(); AddChild(game);
            game.ConfigureIsolatedWorld(seed, editsPath, itemsPath);
            var player = game.GetNode<FirstPersonPlayer>("Player");
            var world = game.GetNode<VoxelWorld>("World");
            var hud = game.GetNode<GameHud>("HUD");
            var weather = game.GetNode<WeatherVisual>("Weather");
            await Frames(110);
            Check(player.IsOnFloor() && game.Life.Health == 20 && game.Life.Hunger == 20, "healthy grounded spawn");

            game.Cycle.SetTime(.25f);
            await Frames(15);
            var sun = game.GetChildren().OfType<DirectionalLight3D>().First();
            var dayEnergy = sun.LightEnergy;
            game.Cycle.SetTime(.75f);
            await Frames(15);
            Check(sun.LightEnergy < dayEnergy * .35f && hud.CurrentCycleText.Contains("00:00"), "night lighting and clock");
            game.Cycle.SetWeather(WeatherKind.Rain);
            game.Cycle.Tick(18);
            await Frames(3);
            Check(weather.GetChildren().OfType<MultiMeshInstance3D>().First().Visible, "rain visible");
            weather.SetConditions(WeatherKind.Rain, true, .8f);
            weather._Process(.016);
            Check(weather.GetChildren().OfType<MultiMeshInstance3D>().Last().Visible, "snow visible");
            game.Cycle.SetWeather(WeatherKind.Storm);
            game.Cycle.Tick(80);
            Check(game.Cycle.LightningFlash > 0, "thunderstorm lightning");

            var home = player.GlobalPosition;
            game.Cycle.SetWeather(WeatherKind.Clear);
            game.Cycle.SetTime(.25f);
            player.GlobalPosition = home + Vector3.Up * 12;
            await Frames(150);
            Check(player.IsOnFloor() && game.Life.Health < 20, "fall damage after landing");
            game.Life.Load(new SurvivalSave(10, 10, 0, 10, 0, GameMode.Survival, null, BlockType.Stone));
            game.Inventory.Slots.Set(0, new ItemStack("berries", 2));
            game.SelectHotbarSlot(0);
            Check(game.UseSelected() && game.Life.Hunger == 13 && game.Inventory.Slots[0].Count == 1, "food consumption");
            game.Inventory.Slots.Set(1, new ItemStack("bandage", 1));
            game.SelectHotbarSlot(1);
            Check(game.UseSelected() && game.Life.Health == 16, "healing item");

            var bx = Mathf.RoundToInt(home.X) + 5;
            var bz = Mathf.RoundToInt(home.Z);
            var by = world.SurfaceHeight(bx, bz) + 2;
            var bed = new CellKey(bx, by, bz);
            Check(world.ApplyChanges((bed, new BlockState(BlockType.Bed))), "bed placed");
            Check(game.SleepAt(bed) && game.Life.BedSpawn == bed, "bed saves spawn during day");
            game.Cycle.SetTime(.75f);
            Check(game.SleepAt(bed) && !game.Cycle.IsNight, "sleep advances to morning");

            game.TakeDamage(100, DamageKind.Fall);
            Check(game.IsDead && hud.DeathShown && player.ProcessMode == ProcessModeEnum.Disabled, "death overlay and control lock");
            Check(game.Inventory.Slots.Count("berries") == 0 && game.GetChildren().OfType<DroppedBlock>().Any(), "death drops inventory");
            game.Respawn();
            Check(!game.IsDead && game.Life.Health == 20 && player.GlobalPosition.DistanceTo(new Vector3(bed.X, bed.Y + 1, bed.Z)) < .1f,
                "respawn at bed");
            Check(world.ApplyChanges((bed, BlockState.Empty)), "bed removed");
            game.TakeDamage(100, DamageKind.Fall);
            game.Respawn();
            Check(game.Life.BedSpawn == null && !game.IsDead, "destroyed bed falls back to world spawn");

            game.SetMode(GameMode.Creative);
            Check(player.Flying && game.Life.Mode == GameMode.Creative, "creative flight enabled");
            var before = game.Life.Health;
            game.TakeDamage(10, DamageKind.Lightning);
            Check(game.Life.Health == before, "creative damage immunity");
            var startY = player.GlobalPosition.Y;
            Input.ActionPress("jump"); await Frames(12); Input.ActionRelease("jump");
            Check(player.GlobalPosition.Y > startY + .5f, "creative upward flight");
            game.Inventory.Slots.Set(0, ItemStack.Empty);
            game.SelectHotbarSlot(0);
            game.Life.SelectCreativeBlock(BlockType.Glass);
            var gx = Mathf.RoundToInt(player.GlobalPosition.X) + 6;
            var gz = Mathf.RoundToInt(player.GlobalPosition.Z);
            var ground = new CellKey(gx, world.SurfaceHeight(gx, gz), gz);
            var built = new CellKey(gx, ground.Y + 1, gz);
            Check(world.ApplyChanges((built, BlockState.Empty)), "creative build location cleared");
            Check(game.TryPlaceSelected(ground, Vector3I.Up) && world.GetState(built.X, built.Y, built.Z).Type == BlockType.Glass &&
                game.Inventory.Slots[0].IsEmpty, "unrestricted creative placement");
            Check(game.MineBlock(built, 0) && world.GetState(built.X, built.Y, built.Z).Type == BlockType.Air,
                "instant creative mining");
            game.ConfigureIsolatedWorld(seed, editsPath, itemsPath);
            Check(game.Life.Mode == GameMode.Creative && game.Cycle.Day >= 1, "mode and time restored from save");
            GD.Print("SURVIVAL PROBE PASS: health, fall, food, healing, death, bed respawn, modes, flight, weather, day-night, persistence");
            game.QueueFree();
            await Frames(60);
            if (File.Exists(editsPath)) File.Delete(editsPath);
            if (File.Exists(itemsPath)) File.Delete(itemsPath);
            GetTree().Quit(0);
        }
        catch (Exception error)
        {
            Input.ActionRelease("jump");
            GD.PushError($"SURVIVAL PROBE FAIL: {error}");
            GetTree().Quit(1);
        }
    }
    private async System.Threading.Tasks.Task Frames(int count)
    {
        for (var i = 0; i < count; i++) await ToSignal(GetTree(), SceneTree.SignalName.PhysicsFrame);
    }
    private static void Check(bool value, string label)
    {
        if (!value) throw new Exception(label);
    }
}
