using Godot;
using Stonewake.World;

namespace Stonewake.Game;

public partial class BreakBurst : Node3D
{
    private readonly MeshInstance3D[] _pieces = new MeshInstance3D[8];
    private readonly Vector3[] _velocities = new Vector3[8];
    private float _age;

    public void Setup(Material material)
    {
        ProcessMode = ProcessModeEnum.Pausable;
        for (var i = 0; i < _pieces.Length; i++)
        {
            var piece = new MeshInstance3D
            {
                Mesh = new BoxMesh { Size = Vector3.One * .12f },
                MaterialOverride = material,
                Position = new Vector3((i % 2 == 0 ? -1 : 1) * .15f, (i / 2 % 2 == 0 ? -1 : 1) * .15f, (i / 4 == 0 ? -1 : 1) * .15f)
            };
            AddChild(piece);
            _pieces[i] = piece;
            _velocities[i] = new Vector3((i % 2 == 0 ? -1 : 1) * (1.2f + i * .1f), 2.5f + i * .13f, (i / 4 == 0 ? -1 : 1) * (1.1f + i * .08f));
        }
    }

    public override void _Process(double delta)
    {
        _age += (float)delta;
        if (_age > .5f) { QueueFree(); return; }
        for (var i = 0; i < _pieces.Length; i++)
        {
            _velocities[i].Y -= 12f * (float)delta;
            _pieces[i].Position += _velocities[i] * (float)delta;
        }
    }
}
