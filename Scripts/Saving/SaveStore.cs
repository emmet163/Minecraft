using Godot;

namespace Stonewake.Saving;

// Small versioned persistence boundary; Phase 1 stores control preferences only.
public static class SaveStore
{
    private const string Path = "user://stonewake.cfg";

    public static float LoadMouseSensitivity(float fallback)
    {
        var file = new ConfigFile();
        if (file.Load(Path) != Error.Ok) return fallback;
        return (float)file.GetValue("controls", "mouse_sensitivity", fallback);
    }

    public static Error SaveMouseSensitivity(float value)
    {
        var file = new ConfigFile();
        file.Load(Path);
        file.SetValue("meta", "format_version", 1);
        file.SetValue("controls", "mouse_sensitivity", value);
        return file.Save(Path);
    }

    public static (int Seed, int RenderDistance) LoadWorldSettings()
    {
        var file = new ConfigFile();
        if (file.Load(Path) != Error.Ok) return (12345, 2);
        return ((int)file.GetValue("world", "seed", 12345),
                System.Math.Clamp((int)file.GetValue("world", "render_distance", 2), 2, 6));
    }

    public static Error SaveWorldSettings(int seed, int renderDistance)
    {
        var file = new ConfigFile();
        file.Load(Path);
        file.SetValue("meta", "format_version", 2);
        file.SetValue("world", "seed", seed);
        file.SetValue("world", "render_distance", System.Math.Clamp(renderDistance, 2, 6));
        return file.Save(Path);
    }
}
