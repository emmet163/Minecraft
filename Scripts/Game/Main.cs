using Godot;
using Stonewake.Player;
using Stonewake.UI;
using Stonewake.World;

namespace Stonewake.Game;

public partial class Main : Node3D
{
    private FirstPersonPlayer _player = null!;
    private GameHud _hud = null!;
    private bool _paused;

    public override void _Ready()
    {
        ControlSettings.Load();
        RegisterControls();
        AddChild(new VoxelWorld { Name = "World" });
        CreateLighting();
        _player = new FirstPersonPlayer { Position = new Vector3(0f, 2.5f, 0f) };
        AddChild(_player);
        _hud = new GameHud { Name = "HUD" };
        AddChild(_hud);
        Input.MouseMode = Input.MouseModeEnum.Captured;
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event.IsActionPressed("pause"))
        {
            SetPaused(!_paused);
            GetViewport().SetInputAsHandled();
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_paused) return;
        var camera = _player.Camera;
        var origin = camera.GlobalPosition;
        var end = origin - camera.GlobalTransform.Basis.Z * 6f;
        var query = PhysicsRayQueryParameters3D.Create(origin, end);
        query.Exclude = new Godot.Collections.Array<Rid> { _player.GetRid() };
        var hit = GetWorld3D().DirectSpaceState.IntersectRay(query);
        if (hit.Count > 0 && hit["collider"].AsGodotObject() is StaticBody3D block && block.HasMeta("block_type"))
        {
            var type = block.GetMeta("block_type").AsString();
            var cell = block.GetMeta("block_position").AsVector3I();
            _hud.SetTarget($"{type}  ·  {cell.X}, {cell.Y}, {cell.Z}");
        }
        else _hud.SetTarget("");
    }

    public void SetPaused(bool paused)
    {
        _paused = paused;
        GetTree().Paused = paused;
        Input.MouseMode = paused ? Input.MouseModeEnum.Visible : Input.MouseModeEnum.Captured;
        _hud.ShowPause(paused);
    }

    private static void RegisterControls()
    {
        Bind("move_forward", Key.W);
        Bind("move_back", Key.S);
        Bind("move_left", Key.A);
        Bind("move_right", Key.D);
        Bind("jump", Key.Space);
        Bind("sprint", Key.Shift);
        Bind("crouch", Key.Ctrl);
        Bind("pause", Key.Escape);
    }

    private static void Bind(string action, Key key)
    {
        if (!InputMap.HasAction(action)) InputMap.AddAction(action);
        InputMap.ActionAddEvent(action, new InputEventKey { PhysicalKeycode = key });
    }

    private void CreateLighting()
    {
        var environment = new WorldEnvironment();
        environment.Environment = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Sky,
            Sky = new Sky { SkyMaterial = new ProceduralSkyMaterial
            {
                SkyTopColor = new Color(0.20f, 0.43f, 0.72f),
                SkyHorizonColor = new Color(0.70f, 0.81f, 0.91f),
                GroundBottomColor = new Color(0.25f, 0.27f, 0.30f)
            } },
            AmbientLightSource = Godot.Environment.AmbientSource.Sky,
            ReflectedLightSource = Godot.Environment.ReflectionSource.Bg
        };
        AddChild(environment);
        var sun = new DirectionalLight3D { LightEnergy = 1.4f, ShadowEnabled = true };
        sun.RotationDegrees = new Vector3(-52f, -35f, 0f);
        AddChild(sun);
    }
}
