using System;
using System.IO;
using Godot;
using Stonewake.Game;
using Stonewake.Player;
using Stonewake.UI;
using Stonewake.World;

namespace Stonewake.Tests;

public partial class InventoryProbe : Node
{
    public override async void _Ready()
    {
        try
        {
            var game = new Main(); AddChild(game);
            var panel = game.GetNode<InventoryPanel>("InventoryPanel");
            var inventory = game.Inventory;
            var player = game.GetNode<FirstPersonPlayer>("Player");
            var world = game.GetNode<VoxelWorld>("World");
            for (var i = 0; i < 60; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            CellKey? plant = null;
            var px = Mathf.RoundToInt(player.GlobalPosition.X);
            var pz = Mathf.RoundToInt(player.GlobalPosition.Z);
            for (var z = pz - 12; z <= pz + 12 && !plant.HasValue; z++)
            for (var x = px - 12; x <= px + 12 && !plant.HasValue; x++)
            for (var y = 1; y < ChunkData.Height; y++)
            {
                if (world.GetBlock(x, y, z) is not (BlockType.Plant or BlockType.Flower)) continue;
                plant = new CellKey(x, y, z); break;
            }
            Check(plant.HasValue, "generated vegetation available");
            var p = plant!.Value;
            Check(game.FindDecorativeTarget(new Vector3(p.X, p.Y, p.Z + 1), Vector3.Forward, 1.5f) == p,
                "ray can target decorative crafting materials");
            Check(inventory.Slots.Size == 36 && inventory.Equipment.Size == 4, "inventory and equipment sizes");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.E, Pressed = true });
            Check(panel.IsOpen && Input.MouseMode == Input.MouseModeEnum.Visible, "E opens inventory and releases mouse");
            Check(player.ProcessMode == ProcessModeEnum.Disabled, "movement stops in inventory");
            game._UnhandledInput(new InputEventKey { PhysicalKeycode = Key.Escape, Pressed = true });
            Check(!panel.IsOpen && player.ProcessMode == ProcessModeEnum.Pausable, "Escape closes inventory and resumes movement");
            const int probeSeed = 987654321;
            var editPath = ProjectSettings.GlobalizePath("user://phase4_probe_edits.json");
            var itemPath = ProjectSettings.GlobalizePath($"user://items_{probeSeed}.json");
            if (File.Exists(editPath)) File.Delete(editPath);
            if (File.Exists(itemPath)) File.Delete(itemPath);
            world.Configure(probeSeed, 2, player, editPath);
            for (var i = 0; i < 50; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            var x0 = Mathf.RoundToInt(player.GlobalPosition.X);
            var z0 = Mathf.RoundToInt(player.GlobalPosition.Z);
            var y0 = new WorldGenerator(probeSeed).SurfaceHeight(x0, z0) + 4;
            var stationCell = new CellKey(x0 + 1, y0, z0);
            var chestCell = new CellKey(x0 + 2, y0, z0);
            var furnaceCell = new CellKey(x0 + 3, y0, z0);
            Check(world.ApplyChanges((stationCell, new BlockState(BlockType.CraftingStation)),
                (chestCell, new BlockState(BlockType.Chest)), (furnaceCell, new BlockState(BlockType.Furnace))), "workstations placed");
            Check(game.TryPlaceSelected(stationCell, Vector3I.Up) && panel.IsOpen, "right click opens 3x3 station");
            panel.Close();
            Check(game.TryPlaceSelected(chestCell, Vector3I.Up) && panel.IsOpen, "right click opens chest");
            panel.Close();
            Check(game.TryPlaceSelected(furnaceCell, Vector3I.Up) && panel.IsOpen, "right click opens furnace");
            panel.Close();
            game.OpenInventory(InventoryMode.Personal);
            for (var i = 0; i < 30; i++) await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            panel.Close();
            game.QueueFree();
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            if (File.Exists(editPath)) File.Delete(editPath);
            if (File.Exists(itemPath)) File.Delete(itemPath);
            GD.Print("INVENTORY PROBE PASS: 36 slots, inventory open/close, right-click station/chest/furnace, vegetation targeting, mouse release");
            GetTree().Quit(0);
        }
        catch (Exception error) { GD.PushError($"INVENTORY PROBE FAIL: {error}"); GetTree().Quit(1); }
    }
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
}
