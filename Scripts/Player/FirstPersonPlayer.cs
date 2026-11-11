using Godot;

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

    public Camera3D Camera => _camera;

    public override void _Ready()
    {
        Name = "Player";
        ProcessMode = ProcessModeEnum.Pausable;
        FloorSnapLength = 0.3f;
        _capsule = new CapsuleShape3D { Radius = 0.34f, Height = StandingHeight };
        _collider = new CollisionShape3D { Shape = _capsule, Position = new Vector3(0f, StandingHeight / 2f, 0f) };
        AddChild(_collider);
        _camera = new Camera3D { Current = true, Position = new Vector3(0f, 1.62f, 0f), Fov = 75f };
        AddChild(_camera);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventMouseMotion motion && Input.MouseMode == Input.MouseModeEnum.Captured)
        {
            var scale = ControlSettings.MouseSensitivity * 0.01f;
            RotateY(-motion.Relative.X * scale);
            _pitch = Mathf.Clamp(_pitch - motion.Relative.Y * scale, Mathf.DegToRad(-89f), Mathf.DegToRad(89f));
            _camera.Rotation = new Vector3(_pitch, 0f, 0f);
        }
    }

    public override void _PhysicsProcess(double delta)
    {
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
    }
}
