using System;

namespace Stonewake.Survival;

public enum WeatherKind { Clear, Rain, Storm }
public sealed record WorldCycleSave(int Day, float TimeOfDay, int WeatherStep, float WeatherClock,
    float WeatherIntensity, WeatherKind Weather);

public sealed class WorldCycle
{
    public const float DaySeconds = 1200;
    public int Day { get; private set; } = 1;
    public float TimeOfDay { get; private set; } = .12f; // 0 = 06:00, .25 = noon, .5 = 18:00, .75 = midnight.
    public int Hour => ((int)Math.Floor(6 + TimeOfDay * 24)) % 24;
    public float Daylight => Math.Clamp((float)Math.Sin(TimeOfDay * Math.PI * 2), 0, 1);
    public bool IsNight => Daylight < .18f;
    public WeatherKind Weather { get; private set; } = WeatherKind.Clear;
    public float WeatherIntensity { get; private set; }
    public float LightningFlash { get; private set; }
    private int _seed;
    private int _weatherStep;
    private float _weatherClock;
    private float _lightningClock;
    public void Configure(int seed)
    {
        _seed = seed; Day = 1; TimeOfDay = .12f; _weatherStep = 0; _weatherClock = 0;
        _lightningClock = 0; Weather = WeatherKind.Clear; WeatherIntensity = 0; LightningFlash = 0;
    }
    public void Tick(float seconds)
    {
        if (seconds <= 0) return;
        TimeOfDay += seconds / DaySeconds;
        while (TimeOfDay >= 1) { TimeOfDay -= 1; Day++; }
        _weatherClock += seconds;
        while (_weatherClock >= 180)
        {
            _weatherClock -= 180;
            _weatherStep++;
            Weather = WeatherFor(_seed, _weatherStep);
        }
        WeatherIntensity = MoveToward(WeatherIntensity, Weather == WeatherKind.Clear ? 0 : Weather == WeatherKind.Storm ? 1 : .65f, seconds / 18);
        LightningFlash = Math.Max(0, LightningFlash - seconds * 3);
        if (Weather == WeatherKind.Storm && WeatherIntensity > .7f)
        {
            _lightningClock += seconds;
            if (_lightningClock >= 35 + Hash(_seed, _weatherStep) % 25)
            { _lightningClock = 0; LightningFlash = 1; }
        }
        else _lightningClock = 0;
    }
    public void SleepToMorning()
    {
        if (!IsNight) return;
        Day++;
        TimeOfDay = .04f;
        Weather = WeatherKind.Clear;
        WeatherIntensity = 0;
        _weatherClock = 0;
        _weatherStep++;
    }
    public void SetTime(float fraction) => TimeOfDay = ((fraction % 1) + 1) % 1;
    public void SetWeather(WeatherKind weather) { Weather = weather; _weatherClock = 0; }
    public WorldCycleSave Snapshot() => new(Day, TimeOfDay, _weatherStep, _weatherClock, WeatherIntensity, Weather);
    public void Load(WorldCycleSave? save, int seed)
    {
        Configure(seed);
        if (save == null) return;
        Day = Math.Max(1, save.Day);
        SetTime(save.TimeOfDay);
        _weatherStep = Math.Max(0, save.WeatherStep);
        _weatherClock = Math.Clamp(save.WeatherClock, 0, 180);
        Weather = Enum.IsDefined(save.Weather) ? save.Weather : WeatherKind.Clear;
        WeatherIntensity = Math.Clamp(save.WeatherIntensity, 0, 1);
    }
    private static WeatherKind WeatherFor(int seed, int step)
    {
        var roll = Hash(seed, step) % 10;
        return roll < 5 ? WeatherKind.Clear : roll < 8 ? WeatherKind.Rain : WeatherKind.Storm;
    }
    private static int Hash(int seed, int step)
    {
        unchecked
        {
            var value = (uint)seed ^ ((uint)step * 0x9e3779b9u);
            value ^= value >> 16; value *= 0x7feb352du;
            value ^= value >> 15; value *= 0x846ca68bu;
            return (int)((value ^ (value >> 16)) & 0x7fffffff);
        }
    }
    private static float MoveToward(float from, float to, float amount) =>
        from < to ? Math.Min(to, from + amount) : Math.Max(to, from - amount);
}
