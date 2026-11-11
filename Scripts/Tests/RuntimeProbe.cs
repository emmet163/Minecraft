using System;
using Godot;
using Stonewake.Game;
using Stonewake.Player;
using Stonewake.UI;
using Stonewake.World;

namespace Stonewake.Tests;

// Headless integration check: godot --headless --path . res://Tests/RuntimeProbe.tscn
public partial class RuntimeProbe : Node
{
    public override async void _Ready()
    {
        try
        {
            var game = new Main();
            AddChild(game);
            var player = game.GetNode<FirstPersonPlayer>("Player");
            var world = game.GetNode<VoxelWorld>("World");
            var hud = game.GetNode<GameHud>("HUD");
            await Frames(100);
            Check(player.IsOnFloor(), "player reaches the ground and collides");
            var start = player.GlobalPosition;
            Input.ActionPress("move_forward");
            await Frames(25);
            Input.ActionRelease("move_forward");
            Check(player.GlobalPosition.DistanceTo(start) > 1f, "WASD movement");

            Input.ActionPress("jump");
            await Frames(2);
            Input.ActionRelease("jump");
            Check(player.Velocity.Y > 0, "jump impulse");
            await Frames(100);
            Check(player.IsOnFloor(), "gravity returns player to floor");

            Input.ActionPress("sprint");
            Input.ActionPress("move_back");
            await Frames(2);
            Check(new Vector2(player.Velocity.X, player.Velocity.Z).Length() > 7f, "sprint speed");
            Input.ActionRelease("sprint");
            Input.ActionRelease("move_back");

            var beforeLook = player.Camera.Rotation.X;
            player.ApplyLook(new Vector2(0, 20));
            Check(Math.Abs(player.Camera.Rotation.X - beforeLook) > .001f, "mouse camera rotation");
            player.ApplyLook(new Vector2(0, 500));
            await Frames(3);
            Check(hud.CurrentTargetText.Length > 0, "block-targeting raycast");

            Input.ActionPress("crouch");
            await Frames(20);
            Check(player.Camera.Position.Y < 1.2f, "crouch camera");
            Check(((CapsuleShape3D)player.GetNode<CollisionShape3D>("Collider").Shape).Height < 1.3f, "crouch collision");
            Input.ActionRelease("crouch");
            await Frames(20);

            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Escape, Pressed = true });
            Check(GetTree().Paused, "Escape pauses");
            var pausedAt = player.GlobalPosition;
            Input.ActionPress("move_forward");
            await Frames(15);
            Check(player.GlobalPosition.DistanceTo(pausedAt) < .001f, "pause freezes player");
            Input.ActionRelease("move_forward");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Escape, Pressed = true });
            Check(!GetTree().Paused, "Escape resumes");

            var oldCenter = new Vector2I(Mathf.FloorToInt(player.GlobalPosition.X / ChunkData.Size), Mathf.FloorToInt(player.GlobalPosition.Z / ChunkData.Size));
            player.ProcessMode = ProcessModeEnum.Disabled;
            player.GlobalPosition += new Vector3(ChunkData.Size * 4, 0, 0);
            await Frames(250);
            var newCenter = new Vector2I(Mathf.FloorToInt(player.GlobalPosition.X / ChunkData.Size), Mathf.FloorToInt(player.GlobalPosition.Z / ChunkData.Size));
            Check(world.LoadedCount > 1, "dynamic chunk loading");
            Check(world.GetBlock(newCenter.X * ChunkData.Size, world.GetBiome(newCenter.X * ChunkData.Size, newCenter.Y * ChunkData.Size) == Biome.Ocean ? WorldGenerator.SeaLevel : 0, newCenter.Y * ChunkData.Size) != BlockType.Air, "new location generated");
            Check(world.LoadedCount <= (world.RenderDistance * 2 + 3) * (world.RenderDistance * 2 + 3), "old chunks unloaded");
            Check(world.GetBlock(oldCenter.X * ChunkData.Size, 0, oldCenter.Y * ChunkData.Size) == BlockType.Air, "old center unloaded");
            var testData = new WorldGenerator(world.Seed).Generate(newCenter.X, newCenter.Y);
            var mesh = ChunkMesher.Build(testData);
            Check(mesh.VisibleFaces < ChunkData.Size * ChunkData.Size * ChunkData.Height * 6, "hidden-face culling");
            Check(mesh.Collision.Count > 0, "chunk collision generated");
            player.GlobalPosition -= new Vector3(ChunkData.Size * 4, 0, 0);
            await Frames(250);
            Check(world.GetBlock(oldCenter.X * ChunkData.Size, 0, oldCenter.Y * ChunkData.Size) != BlockType.Air, "unloaded chunk regenerates on revisit");
            long managedBytes = 0;
            for (var cycle = 0; cycle < 2; cycle++)
            {
                player.GlobalPosition += new Vector3(ChunkData.Size * 4, 0, 0);
                await Frames(100);
                player.GlobalPosition -= new Vector3(ChunkData.Size * 4, 0, 0);
                await Frames(100);
                Check(world.LoadedCount <= (world.RenderDistance * 2 + 3) * (world.RenderDistance * 2 + 3), "bounded loaded chunks");
                GC.Collect();
                managedBytes = GC.GetTotalMemory(true);
            }
            var priorSeed = world.Seed;
            world.Configure(priorSeed + 1, 3, player);
            Check(world.RenderDistance == 3 && world.Seed == priorSeed + 1, "world settings apply");
            await Frames(60);
            world.Configure(priorSeed + 1, 6, player);
            await Frames(240);
            Check(world.LoadedCount >= 150 && world.LoadedCount <= 169, "maximum render distance loads within bound");
            var maxDistanceManagedBytes = GC.GetTotalMemory(true);
            GD.Print($"RUNTIME PROBE PASS: loaded={world.LoadedCount}, pending={world.PendingCount}, last_chunk_ms={world.LastGenerationMilliseconds}, managed_bytes_default={managedBytes}, managed_bytes_max={maxDistanceManagedBytes}, from={oldCenter}, to={newCenter}");
            GetTree().Quit(0);
        }
        catch (Exception error)
        {
            GD.PushError($"RUNTIME PROBE FAIL: {error}");
            GetTree().Quit(1);
        }
    }

    private async System.Threading.Tasks.Task Frames(int count)
    {
        for (var i = 0; i < count; i++) await ToSignal(GetTree(), SceneTree.SignalName.PhysicsFrame);
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
}
