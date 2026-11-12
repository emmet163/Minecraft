using Godot;
using Stonewake.Items;

namespace Stonewake.World;

public partial class DroppedBlock : RigidBody3D
{
    private double _age;
    public BlockType Type { get; private set; }
    public string ItemId { get; private set; } = "";
    public int Count { get; private set; } = 1;
    public double Age => _age;
    public void SetCount(int count) => Count = count;

    public void Setup(BlockType type, Material material)
    {
        Type = type;
        ItemId = ItemCatalog.ForBlock(type);
        SetupVisual(material);
    }
    public void Setup(string id, int count, Material material)
    {
        ItemId = id;
        Count = count;
        Type = ItemCatalog.BlockOf(id);
        SetupVisual(material);
    }
    private void SetupVisual(Material material)
    {
        Name = $"Drop_{ItemId}";
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
