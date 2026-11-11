using Godot;
using Stonewake.Player;

namespace Stonewake.UI;

public partial class GameHud : CanvasLayer
{
    private Label _targetLabel = null!;
    private Control _pauseOverlay = null!;
    private Label _sensitivityValue = null!;

    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Always;
        var root = new Control();
        root.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        AddChild(root);

        var crosshair = new Label { Text = "+", HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        crosshair.SetAnchorsPreset(Control.LayoutPreset.Center);
        crosshair.OffsetLeft = -10;
        crosshair.OffsetTop = -12;
        crosshair.OffsetRight = 10;
        crosshair.OffsetBottom = 12;
        crosshair.AddThemeFontSizeOverride("font_size", 24);
        root.AddChild(crosshair);

        _targetLabel = new Label { Text = "", Position = new Vector2(18, 18) };
        root.AddChild(_targetLabel);

        _pauseOverlay = new ColorRect { Color = new Color(0.05f, 0.07f, 0.1f, 0.82f), Visible = false };
        _pauseOverlay.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        root.AddChild(_pauseOverlay);

        var panel = new PanelContainer();
        panel.SetAnchorsPreset(Control.LayoutPreset.Center);
        panel.OffsetLeft = -190;
        panel.OffsetTop = -145;
        panel.OffsetRight = 190;
        panel.OffsetBottom = 145;
        _pauseOverlay.AddChild(panel);

        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 24);
        margin.AddThemeConstantOverride("margin_right", 24);
        margin.AddThemeConstantOverride("margin_top", 20);
        margin.AddThemeConstantOverride("margin_bottom", 20);
        panel.AddChild(margin);
        var stack = new VBoxContainer();
        stack.AddThemeConstantOverride("separation", 12);
        margin.AddChild(stack);
        stack.AddChild(new Label { Text = "STONEWAKE  ·  PAUSED", HorizontalAlignment = HorizontalAlignment.Center });
        stack.AddChild(new Label { Text = "Mouse sensitivity" });
        var slider = new HSlider { MinValue = 0.03, MaxValue = 0.5, Step = 0.01, Value = ControlSettings.MouseSensitivity };
        stack.AddChild(slider);
        _sensitivityValue = new Label { Text = ControlSettings.MouseSensitivity.ToString("0.00"), HorizontalAlignment = HorizontalAlignment.Center };
        stack.AddChild(_sensitivityValue);
        slider.ValueChanged += value =>
        {
            ControlSettings.SetMouseSensitivity((float)value);
            _sensitivityValue.Text = ControlSettings.MouseSensitivity.ToString("0.00");
        };
        stack.AddChild(new Label { Text = "WASD move  ·  Space jump  ·  Shift sprint\nCtrl crouch  ·  Esc pause", HorizontalAlignment = HorizontalAlignment.Center });
        var resume = new Button { Text = "Resume" };
        resume.Pressed += () => ((Stonewake.Game.Main)GetParent()).SetPaused(false);
        stack.AddChild(resume);
        var quit = new Button { Text = "Quit" };
        quit.Pressed += () => GetTree().Quit();
        stack.AddChild(quit);
    }

    public void SetTarget(string text) => _targetLabel.Text = text;
    public void ShowPause(bool paused) => _pauseOverlay.Visible = paused;
}
