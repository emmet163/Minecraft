using Godot;

namespace Stonewake.World;

public partial class DroppedBlock : RigidBody3D
{
    private double _age;
    public BlockType Type { get; private set; }
    public double Age => _age;

    public void Setup(BlockType type, Material material)
    {
        Type = type;
        Name = $"Drop_{type}";
        Mass = .25f;
        LinearDamp = 1.2f;
        AddChild(new MeshInstance3D
        {
            Mesh = new BoxMesh { Size = Vector3.One * .28f },
            MaterialOverride = material
        });
        AddChild(new CollisionShape3D { Shape = new BoxShape3D { Size = Vector3.One * .28f } });
    }

    public override void _PhysicsProcess(double delta)
    {
        _age += delta;
        if (_age > 90) QueueFree();
    }
}
