using Godot;
using System;

namespace Stonewake.Player;

public partial class FirstPersonPlayer : CharacterBody3D
{
    private const float WalkSpeed = 5f;
    private const float SprintSpeed = 8f;
    private const float CrouchSpeed = 2.5f;
    private const float JumpVelocity = 7f;
    private const float Gravity = 22f;
    private const float StandingHeight = 1.8f;
    private const float CrouchingHeight = 1.15f;

    private Camera3D _camera = null!;
    private CollisionShape3D _collider = null!;
    private CapsuleShape3D _capsule = null!;
    private float _pitch;
    private bool _airborne;
    private float _peakY;

    public Camera3D Camera => _camera;
    public bool Flying { get; private set; }
    public event Action<float>? Landed;
    public void SetFlight(bool enabled)
    {
        Flying = enabled;
        _airborne = false;
        Velocity = Vector3.Zero;
    }

    public override void _Ready()
    {
        Name = "Player";
        ProcessMode = ProcessModeEnum.Pausable;
        FloorSnapLength = 0.3f;
        _capsule = new CapsuleShape3D { Radius = 0.34f, Height = StandingHeight };
        _collider = new CollisionShape3D { Name = "Collider", Shape = _capsule, Position = new Vector3(0f, StandingHeight / 2f, 0f) };
        AddChild(_collider);
        _camera = new Camera3D { Current = true, Position = new Vector3(0f, 1.62f, 0f), Fov = 75f };
        AddChild(_camera);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventMouseMotion motion && Input.MouseMode == Input.MouseModeEnum.Captured)
            ApplyLook(motion.Relative);
    }

    public void ApplyLook(Vector2 relative)
    {
        var scale = ControlSettings.MouseSensitivity * 0.01f;
        RotateY(-relative.X * scale);
        _pitch = Mathf.Clamp(_pitch - relative.Y * scale, Mathf.DegToRad(-89f), Mathf.DegToRad(89f));
        _camera.Rotation = new Vector3(_pitch, 0f, 0f);
    }

    public override void _PhysicsProcess(double delta)
    {
        if (Flying)
        {
            var flyInput = Input.GetVector("move_left", "move_right", "move_forward", "move_back");
            var horizontal = (Transform.Basis * new Vector3(flyInput.X, 0, flyInput.Y)).Normalized();
            var vertical = (Input.IsActionPressed("jump") ? 1 : 0) - (Input.IsActionPressed("crouch") ? 1 : 0);
            var flySpeed = Input.IsActionPressed("sprint") ? 13f : 8f;
            Velocity = new Vector3(horizontal.X, vertical, horizontal.Z).Normalized() * flySpeed;
            MoveAndSlide();
            return;
        }
        if (!IsOnFloor())
        {
            if (!_airborne) { _airborne = true; _peakY = GlobalPosition.Y; }
            else _peakY = Mathf.Max(_peakY, GlobalPosition.Y);
        }
        var velocity = Velocity;
        if (!IsOnFloor()) velocity.Y -= Gravity * (float)delta;
        else if (Input.IsActionJustPressed("jump")) velocity.Y = JumpVelocity;

        var crouching = Input.IsActionPressed("crouch");
        var desiredHeight = crouching ? CrouchingHeight : StandingHeight;
        _capsule.Height = desiredHeight;
        _collider.Position = new Vector3(0f, desiredHeight / 2f, 0f);
        var cameraHeight = crouching ? 1.02f : 1.62f;
        _camera.Position = new Vector3(0f, Mathf.MoveToward(_camera.Position.Y, cameraHeight, (float)delta * 5f), 0f);

        var input = Input.GetVector("move_left", "move_right", "move_forward", "move_back");
        var direction = (Transform.Basis * new Vector3(input.X, 0f, input.Y)).Normalized();
        var speed = crouching ? CrouchSpeed : Input.IsActionPressed("sprint") ? SprintSpeed : WalkSpeed;
        velocity.X = direction.X * speed;
        velocity.Z = direction.Z * speed;
        Velocity = velocity;
        MoveAndSlide();
        if (IsOnFloor() && _airborne)
        {
            _airborne = false;
            Landed?.Invoke(Mathf.Max(0, _peakY - GlobalPosition.Y));
        }
    }
}
