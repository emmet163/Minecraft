using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Godot;
using Stonewake.Game;
using Stonewake.Player;
using Stonewake.World;

namespace Stonewake.Tests;

public partial class InteractionProbe : Node
{
    public override async void _Ready()
    {
        var path = ProjectSettings.GlobalizePath("user://phase3_interaction_probe.json");
        try
        {
            if (File.Exists(path)) File.Delete(path);
            var game = new Main();
            AddChild(game);
            var player = game.GetNode<FirstPersonPlayer>("Player");
            var world = game.GetNode<VoxelWorld>("World");
            const int seed = 424242;
            world.Configure(seed, 2, player, path);
            await Frames(140);
            Check(player.IsOnFloor(), "initial collision");

            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Q, Pressed = true });
            Check(game.Inventory.Tool == ToolKind.Pickaxe, "tool switch input");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Q, Pressed = true });
            Check(game.Inventory.Tool == ToolKind.Shovel, "second tool switch");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Q, Pressed = true });
            Check(game.Inventory.Tool == ToolKind.Hand, "tool cycle returns to hand");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Key5, Pressed = true });
            Check(game.Inventory.Selected == 4, "number-key hotbar selection");
            game._UnhandledInput(new InputEventMouseButton { ButtonIndex = MouseButton.WheelUp, Pressed = true });
            Check(game.Inventory.Selected == 3, "mouse-wheel hotbar selection");

            var geometry = new ChunkData(0, 0);
            geometry.Set(2, 50, 2, BlockType.Glass);
            geometry.Set(3, 50, 2, BlockType.Glass);
            Check(ChunkMesher.Build(geometry).VisibleFaces == 10, "transparent glass hides shared face");
            geometry.SetState(5, 50, 5, new BlockState(BlockType.Slab, 4));
            geometry.SetState(7, 50, 5, new BlockState(BlockType.Stairs, 1));
            geometry.SetState(9, 50, 5, new BlockState(BlockType.Door, 8));
            geometry.Set(11, 50, 5, BlockType.Fence);
            var shapeMesh = ChunkMesher.Build(geometry);
            Check(shapeMesh.Surfaces.ContainsKey(BlockType.Slab) && shapeMesh.Surfaces.ContainsKey(BlockType.Stairs) &&
                shapeMesh.Surfaces.ContainsKey(BlockType.Door) && shapeMesh.Surfaces.ContainsKey(BlockType.Fence), "shape meshes generated");
            Check(shapeMesh.Collision.Count > 0, "shape collision generated");

            player.ApplyLook(new Vector2(0, 500));
            await Frames(3);
            Check(game.GetNode<MeshInstance3D>("SelectionOutline").Visible, "selection outline");

            var generator = new WorldGenerator(seed);
            var used = new HashSet<(int, int)>();
            var ground = FindClear(world, player, generator, used);
            var original = world.GetState(ground.X, ground.Y, ground.Z);
            var duration = BlockRules.MiningSeconds(original.Type, ToolKind.Hand);
            Check(!game.MineBlock(ground, duration * .5f), "hardness requires duration");
            Check(world.GetState(ground.X, ground.Y, ground.Z).Type == original.Type, "partial mining keeps block");
            Check(game.MineBlock(ground, duration * .6f), "timed mining breaks block");
            Check(world.GetState(ground.X, ground.Y, ground.Z).Type == BlockType.Air, "mined block is air");
            Check(game.GetChildren().OfType<BreakBurst>().Any(), "break particles spawned");
            Check(File.Exists(path), "edits saved to disk");

            var drop = game.GetChildren().OfType<DroppedBlock>().FirstOrDefault();
            Check(drop != null, "block drop spawned");
            var dropType = drop!.Type;
            var beforePickup = game.Inventory.Count(dropType);
            await Frames(30);
            drop.GlobalPosition = player.GlobalPosition + Vector3.Up;
            await Frames(3);
            Check(game.Inventory.Count(dropType) == beforePickup + 1, "drop collected");

            game.SelectHotbarSlot(0);
            var below = new CellKey(ground.X, ground.Y - 1, ground.Z);
            Check(game.TryPlaceSelected(below, Vector3I.Up), "right-click placement path");
            Check(world.GetState(ground.X, ground.Y, ground.Z).Type == BlockType.Dirt, "placed dirt occupies mined cell");
            Check(!game.TryPlaceSelected(below, Vector3I.Up), "occupied block cannot be overwritten");

            var playerX = Mathf.RoundToInt(player.GlobalPosition.X);
            var playerZ = Mathf.RoundToInt(player.GlobalPosition.Z);
            var playerGround = new CellKey(playerX, generator.SurfaceHeight(playerX, playerZ), playerZ);
            Check(!game.TryPlaceSelected(playerGround, Vector3I.Up), "cannot place inside player");

            var slabGround = FindClear(world, player, generator, used);
            game.SelectHotbarSlot(5);
            Check(game.TryPlaceSelected(slabGround, Vector3I.Up), "slab placement");
            var slabCell = new CellKey(slabGround.X, slabGround.Y + 1, slabGround.Z);
            Check(world.GetState(slabCell.X, slabCell.Y, slabCell.Z).Type == BlockType.Slab, "slab state");
            await Frames(2);
            using (var ray = PhysicsRayQueryParameters3D.Create(
                new Vector3(slabCell.X, slabCell.Y + .25f, slabCell.Z),
                new Vector3(slabCell.X, slabCell.Y - .3f, slabCell.Z)))
            {
                var slabHit = world.GetWorld3D().DirectSpaceState.IntersectRay(ray);
                Check(slabHit.Count > 0 && Mathf.Abs(slabHit["position"].AsVector3().Y - slabCell.Y) < .1f,
                    "slab collision height");
            }

            var stairGround = FindClear(world, player, generator, used);
            game.SelectHotbarSlot(6);
            Check(game.TryPlaceSelected(stairGround, Vector3I.Up), "stair placement");
            var stairCell = new CellKey(stairGround.X, stairGround.Y + 1, stairGround.Z);
            Check(world.GetState(stairCell.X, stairCell.Y, stairCell.Z).Type == BlockType.Stairs, "stair state");

            var doorGround = FindClear(world, player, generator, used);
            game.SelectHotbarSlot(7);
            Check(game.TryPlaceSelected(doorGround, Vector3I.Up), "door placement");
            var doorCell = new CellKey(doorGround.X, doorGround.Y + 1, doorGround.Z);
            Check(world.GetState(doorCell.X, doorCell.Y + 1, doorCell.Z).Upper, "door upper half");
            Check(game.TryPlaceSelected(doorCell, Vector3I.Right), "door toggle");
            Check(world.GetState(doorCell.X, doorCell.Y, doorCell.Z).Open, "door open state");

            var fenceGround = FindClear(world, player, generator, used);
            game.SelectHotbarSlot(8);
            Check(game.TryPlaceSelected(fenceGround, Vector3I.Up), "fence placement");
            var fenceCell = new CellKey(fenceGround.X, fenceGround.Y + 1, fenceGround.Z);

            var edgeX = (int)Math.Floor(player.GlobalPosition.X / ChunkData.Size) * ChunkData.Size + 15;
            var edgeZBase = (int)Math.Floor(player.GlobalPosition.Z / ChunkData.Size) * ChunkData.Size;
            CellKey edgeCell = default;
            for (var dz = 0; dz < ChunkData.Size; dz++)
            {
                var z = edgeZBase + dz;
                var y = generator.SurfaceHeight(edgeX, z);
                if (world.GetState(edgeX, y + 1, z).Type != BlockType.Air) continue;
                edgeCell = new CellKey(edgeX, y + 1, z);
                break;
            }
            Check(edgeCell.Y > 0, "clear chunk boundary found");
            Check(world.ApplyChanges((edgeCell, new BlockState(BlockType.Glass))), "boundary edit applied");
            var neighbor = world.GetChildren().OfType<VoxelChunk>().First(c => c.Data.X == (edgeX + 1) / ChunkData.Size && c.Data.Z == (int)Math.Floor(edgeCell.Z / (double)ChunkData.Size));
            Check(neighbor.Data.GetWorldState(edgeCell.X, edgeCell.Y, edgeCell.Z).Type == BlockType.Glass, "neighbor border refreshed");

            var fallGround = FindClear(world, player, generator, used);
            var falling = new CellKey(fallGround.X, fallGround.Y + 4, fallGround.Z);
            Check(world.ApplyChanges((falling, new BlockState(BlockType.Gravel))), "gravel placed above air");
            await Frames(60);
            Check(world.GetState(falling.X, falling.Y, falling.Z).Type == BlockType.Air, "gravel falls from start");
            Check(world.GetState(falling.X, fallGround.Y + 1, falling.Z).Type == BlockType.Gravel, "gravel settles on ground");

            var sandGround = FindClear(world, player, generator, used);
            var sandStart = new CellKey(sandGround.X, sandGround.Y + 3, sandGround.Z);
            Check(world.ApplyChanges((sandStart, new BlockState(BlockType.Sand))), "sand placed above air");
            await Frames(45);
            Check(world.GetState(sandStart.X, sandGround.Y + 1, sandStart.Z).Type == BlockType.Sand, "sand settles on ground");

            player.ProcessMode = ProcessModeEnum.Disabled;
            var home = player.GlobalPosition;
            player.GlobalPosition += new Vector3(ChunkData.Size * 4, 0, 0);
            await Frames(150);
            Check(world.GetState(slabCell.X, slabCell.Y, slabCell.Z).Type == BlockType.Air, "edited chunk unloaded");
            player.GlobalPosition = home;
            await Frames(150);
            Check(world.GetState(slabCell.X, slabCell.Y, slabCell.Z).Type == BlockType.Slab, "edit survives unload and revisit");

            world.Configure(seed, 2, player, path);
            await Frames(120);
            Check(world.GetState(ground.X, ground.Y, ground.Z).Type == BlockType.Dirt, "placed block restored after reload");
            Check(world.GetState(slabCell.X, slabCell.Y, slabCell.Z).Type == BlockType.Slab, "slab restored");
            Check(world.GetState(stairCell.X, stairCell.Y, stairCell.Z).Type == BlockType.Stairs, "stair restored");
            Check(world.GetState(doorCell.X, doorCell.Y, doorCell.Z).Open, "door property restored");
            Check(world.GetState(fenceCell.X, fenceCell.Y, fenceCell.Z).Type == BlockType.Fence, "fence restored");
            Check(world.GetState(edgeCell.X, edgeCell.Y, edgeCell.Z).Type == BlockType.Glass, "boundary edit restored");
            Check(world.GetState(sandStart.X, sandGround.Y + 1, sandStart.Z).Type == BlockType.Sand, "falling block saved");
            GD.Print($"INTERACTION PROBE PASS: mining, drops, placement, shapes, door, gravity, boundary, persistence; last_edit_ms={world.LastEditMilliseconds}, managed_bytes={GC.GetTotalMemory(true)}");
            if (File.Exists(path)) File.Delete(path);
            await Frames(20);
            GetTree().Quit(0);
        }
        catch (Exception error)
        {
            GD.PushError($"INTERACTION PROBE FAIL: {error}");
            if (File.Exists(path)) File.Delete(path);
            GetTree().Quit(1);
        }
    }

    private static CellKey FindClear(VoxelWorld world, FirstPersonPlayer player, WorldGenerator generator, HashSet<(int, int)> used)
    {
        var px = Mathf.RoundToInt(player.GlobalPosition.X);
        var pz = Mathf.RoundToInt(player.GlobalPosition.Z);
        for (var radius = 3; radius <= 12; radius++)
        for (var dz = -radius; dz <= radius; dz++)
        for (var dx = -radius; dx <= radius; dx++)
        {
            if (Math.Abs(dx) != radius && Math.Abs(dz) != radius) continue;
            var x = px + dx; var z = pz + dz;
            if (!used.Add((x, z))) continue;
            var y = generator.SurfaceHeight(x, z);
            if (!world.IsLoaded(x, z) || !BlockRules.IsSolid(world.GetBlock(x, y, z)) ||
                world.GetBlock(x, y + 1, z) != BlockType.Air || world.GetBlock(x, y + 2, z) != BlockType.Air) continue;
            return new CellKey(x, y, z);
        }
        throw new Exception("No clear ground for test");
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
