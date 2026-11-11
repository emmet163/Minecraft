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
}
