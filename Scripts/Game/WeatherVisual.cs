using Godot;
using Stonewake.Survival;

namespace Stonewake.Game;

// Lightweight local precipitation that follows the player without spawning physics nodes.
public partial class WeatherVisual : Node3D
{
    private const int Count = 180;
    private MultiMeshInstance3D _rain = null!;
    private MultiMeshInstance3D _snow = null!;
    private Node3D _player = null!;
    private float _time;
    private float _intensity;
    private bool _snowing;
    public void Setup(Node3D player) => _player = player;
    public void SetConditions(WeatherKind weather, bool snow, float intensity)
    {
        _snowing = snow;
        _intensity = weather == WeatherKind.Clear ? intensity : Mathf.Clamp(intensity, 0, 1);
    }
    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Pausable;
        _rain = MakeField(new Vector3(.025f, .32f, .025f), new Color(.48f, .70f, .88f, .75f));
        _snow = MakeField(new Vector3(.075f, .075f, .075f), new Color(.89f, .95f, 1f, .9f));
        AddChild(_rain); AddChild(_snow);
    }
    private static MultiMeshInstance3D MakeField(Vector3 size, Color color)
    {
        var material = new StandardMaterial3D
        {
            AlbedoColor = color,
            ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
            Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
            CullMode = BaseMaterial3D.CullModeEnum.Disabled
        };
        var mesh = new BoxMesh { Size = size, Material = material };
        var multi = new MultiMesh { TransformFormat = MultiMesh.TransformFormatEnum.Transform3D, Mesh = mesh, InstanceCount = Count };
        return new MultiMeshInstance3D { Multimesh = multi, Visible = false };
    }
    public override void _Process(double delta)
    {
        if (_player == null) return;
        GlobalPosition = _player.GlobalPosition;
        _time += (float)delta;
        var active = _intensity > .02f;
        _rain.Visible = active && !_snowing;
        _snow.Visible = active && _snowing;
        if (!active) return;
        var field = _snowing ? _snow : _rain;
        var mesh = field.Multimesh;
        mesh.VisibleInstanceCount = Mathf.Clamp((int)(Count * _intensity), 0, Count);
        for (var i = 0; i < mesh.VisibleInstanceCount; i++)
        {
            var x = Hash(i * 73 + 11) * 24 - 12;
            var z = Hash(i * 97 + 23) * 24 - 12;
            var speed = _snowing ? 2f : 12f;
            var y = Mathf.PosMod(Hash(i * 47 + 7) * 18 - _time * speed, 18) - 5;
            if (_snowing) x += Mathf.Sin(_time + i * .31f) * .5f;
            mesh.SetInstanceTransform(i, new Transform3D(Basis.Identity, new Vector3(x, y, z)));
        }
    }
    private static float Hash(int seed)
    {
        unchecked
        {
            var value = (uint)seed * 747796405u + 2891336453u;
            value = ((value >> ((int)(value >> 28) + 4)) ^ value) * 277803737u;
            return ((value >> 22) ^ value) / (float)uint.MaxValue;
        }
    }
}
