using System;
using System.Linq;
using Godot;
using Stonewake.Game;
using Stonewake.Survival;

namespace Stonewake.Tests;

// Short graphical capture for night weather and the pause-menu layout.
public partial class SurvivalVisualProbe : Node
{
    public override async void _Ready()
    {
        try
        {
            var game = new Main(); AddChild(game);
            game.ConfigureIsolatedWorld(56231499,
                ProjectSettings.GlobalizePath("user://phase5_visual_edits.json"),
                ProjectSettings.GlobalizePath("user://phase5_visual_items.json"));
            game.Cycle.SetTime(.75f);
            game.Cycle.SetWeather(WeatherKind.Storm);
            game.Cycle.Tick(18);
            var pause = OS.GetCmdlineUserArgs().Any(arg => arg is "pause" or "--pause");
            for (var i = 0; i < (pause ? 35 : 100); i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            if (pause) game.SetPaused(true);
            for (var i = 0; i < (pause ? 20 : 30); i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            GD.Print("SURVIVAL VISUAL PROBE PASS");
            GetTree().Quit(0);
        }
        catch (Exception error) { GD.PushError($"SURVIVAL VISUAL PROBE FAIL: {error}"); GetTree().Quit(1); }
    }
}
