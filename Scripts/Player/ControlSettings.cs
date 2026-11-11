using Godot;
using Stonewake.Saving;

namespace Stonewake.Player;

public static class ControlSettings
{
    public static float MouseSensitivity { get; private set; } = 0.12f;

    public static void Load()
    {
        MouseSensitivity = Mathf.Clamp(SaveStore.LoadMouseSensitivity(0.12f), 0.03f, 0.5f);
    }

    public static void SetMouseSensitivity(float value)
    {
        MouseSensitivity = Mathf.Clamp(value, 0.03f, 0.5f);
        var error = SaveStore.SaveMouseSensitivity(MouseSensitivity);
        if (error != Error.Ok) GD.PushWarning($"Could not save controls: {error}");
    }
}
