using System;
using System.Linq;
using Godot;
using Stonewake.Items;
using Stonewake.Player;
using Stonewake.World;
using Stonewake.Survival;

namespace Stonewake.UI;

public enum InventoryMode { Personal, Station, Chest, Furnace }

public partial class InventoryPanel : CanvasLayer
{
    private HotbarInventory _player = null!;
    private WorldItems _world = null!;
    private Control _overlay = null!;
    private GridContainer _backpack = null!;
    private GridContainer _craftGrid = null!;
    private GridContainer _storageGrid = null!;
    private GridContainer _equipmentGrid = null!;
    private Label _heading = null!;
    private Label _recipe = null!;
    private Label _cursorLabel = null!;
    private Label _status = null!;
    private Button _craftButton = null!;
    private ItemList _recipeList = null!;
    private Label _guide = null!;
    private Label _recipeHeader = null!;
    private Label _creativeHeader = null!;
    private OptionButton _creativePalette = null!;
    private RecipeDef[] _shownRecipes = Array.Empty<RecipeDef>();
    private ItemStack Cursor { get => _world.Cursor; set => _world.Cursor = value; }
    private CellKey _cell;
    private InventoryMode _mode;
    private double _refreshClock;
    private string _furnaceVisual = "";
    public bool IsOpen => _overlay.Visible;
    public event Action? Changed;
    public event Action<RecipeDef>? Crafted;
    public event Action<ItemStack>? DropRequested;

    public void Setup(HotbarInventory player, WorldItems world) { _player = player; _world = world; }

    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Always;
        _overlay = new ColorRect { Color = new Color(.035f, .055f, .075f, .94f), Visible = false, MouseFilter = Control.MouseFilterEnum.Stop };
        _overlay.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        AddChild(_overlay);
        var panel = new PanelContainer();
        panel.SetAnchorsPreset(Control.LayoutPreset.Center);
        panel.OffsetLeft = -485; panel.OffsetTop = -330; panel.OffsetRight = 485; panel.OffsetBottom = 330;
        _overlay.AddChild(panel);
        var margin = new MarginContainer();
        foreach (var side in new[] { "margin_left", "margin_right", "margin_top", "margin_bottom" }) margin.AddThemeConstantOverride(side, 18);
        panel.AddChild(margin);
        var columns = new HBoxContainer(); columns.AddThemeConstantOverride("separation", 22); margin.AddChild(columns);
        var left = new VBoxContainer(); left.AddThemeConstantOverride("separation", 10); columns.AddChild(left);
        _heading = new Label { Text = "INVENTORY" }; _heading.AddThemeFontSizeOverride("font_size", 23); left.AddChild(_heading);
        left.AddChild(new Label { Text = "36 slots · first row is your hotbar" });
        _backpack = new GridContainer { Columns = 9 }; _backpack.AddThemeConstantOverride("h_separation", 4); _backpack.AddThemeConstantOverride("v_separation", 4); left.AddChild(_backpack);
        left.AddChild(new Label { Text = "Left click: pick up / place · Right click: split / place one" });
        _status = new Label { Text = "", CustomMinimumSize = new Vector2(545, 35) }; left.AddChild(_status);
        var drop = new Button { Text = "Drop held stack into world" }; drop.Pressed += DropCursor; left.AddChild(drop);
        var close = new Button { Text = "Close (E / Esc)" }; close.Pressed += Close; left.AddChild(close);

        var right = new VBoxContainer(); right.AddThemeConstantOverride("separation", 9); columns.AddChild(right);
        right.AddChild(new Label { Text = "EQUIPMENT: tool / head / body / weapon" });
        _equipmentGrid = new GridContainer { Columns = 2 }; right.AddChild(_equipmentGrid);
        right.AddChild(new HSeparator());
        _recipe = new Label { Text = "PERSONAL CRAFTING · 2×2", CustomMinimumSize = new Vector2(280, 30) }; right.AddChild(_recipe);
        _craftGrid = new GridContainer { Columns = 2 }; right.AddChild(_craftGrid);
        _craftButton = new Button { Text = "Craft" }; _craftButton.Pressed += Craft; right.AddChild(_craftButton);
        right.AddChild(new HSeparator());
        right.AddChild(new Label { Text = "STORAGE / FURNACE" });
        _storageGrid = new GridContainer { Columns = 3 }; right.AddChild(_storageGrid);
        _recipeHeader = new Label { Text = "RECIPE GUIDE" }; right.AddChild(_recipeHeader);
        _recipeList = new ItemList { CustomMinimumSize = new Vector2(280, 120) };
        _recipeList.ItemSelected += index => ShowRecipe((int)index);
        right.AddChild(_recipeList);
        _guide = new Label { Text = "Select a recipe to see its materials.", CustomMinimumSize = new Vector2(280, 50), AutowrapMode = TextServer.AutowrapMode.WordSmart };
        right.AddChild(_guide);
        _creativeHeader = new Label { Text = "CREATIVE BLOCK PALETTE" }; right.AddChild(_creativeHeader);
        _creativePalette = new OptionButton();
        foreach (BlockType block in Enum.GetValues<BlockType>())
            if (block is not (BlockType.Air or BlockType.GrassSide or BlockType.SnowSide))
                _creativePalette.AddItem(block.ToString(), (int)block);
        _creativePalette.ItemSelected += index =>
        {
            _world.Survival.SelectCreativeBlock((BlockType)_creativePalette.GetItemId((int)index));
            Changed?.Invoke();
        };
        right.AddChild(_creativePalette);
        _cursorLabel = new Label { Text = "", MouseFilter = Control.MouseFilterEnum.Ignore, ZIndex = 10 };
        _overlay.AddChild(_cursorLabel);
    }

    public override void _Process(double delta)
    {
        if (!IsOpen) return;
        _cursorLabel.Position = GetViewport().GetMousePosition() + new Vector2(15, 15);
        _refreshClock += delta;
        if (_mode == InventoryMode.Furnace && _refreshClock >= .25)
        {
            _refreshClock = 0;
            var furnace = _world.Furnace(_cell);
            var visual = $"{furnace.Slots[0]}|{furnace.Slots[1]}|{furnace.Slots[2]}";
            if (visual != _furnaceVisual) { _furnaceVisual = visual; Refresh(); }
            else _status.Text = $"Input  |  Fuel  |  Output     Heat {furnace.BurnRemaining:0.0}s  ·  Smelting {furnace.ProgressFraction:P0}";
        }
    }

    public void Open(InventoryMode mode, CellKey cell = default)
    {
        _mode = mode; _cell = cell; _overlay.Visible = true;
        var showGuide = mode is InventoryMode.Personal or InventoryMode.Station;
        var creative = _world.Survival.Mode == GameMode.Creative;
        _recipeHeader.Visible = showGuide; _recipeList.Visible = showGuide; _guide.Visible = showGuide;
        _creativeHeader.Visible = creative; _creativePalette.Visible = creative;
        if (creative)
            for (var i = 0; i < _creativePalette.ItemCount; i++)
                if (_creativePalette.GetItemId(i) == (int)_world.Survival.CreativeBlock) { _creativePalette.Select(i); break; }
        _shownRecipes = RecipeBook.All.Where(recipe => !recipe.Station || mode == InventoryMode.Station).ToArray();
        _recipeList.Clear();
        foreach (var recipe in _shownRecipes) _recipeList.AddItem(ItemCatalog.Get(recipe.Output).Name + $" ×{recipe.Count}");
        _guide.Text = "Select a recipe to see its materials.";
        Refresh();
    }
    public void Close()
    {
        if (!IsOpen) return;
        if (!Cursor.IsEmpty)
        {
            var leftover = _player.Slots.Add(Cursor.Id, Cursor.Count, Cursor.Damage);
            if (leftover > 0) DropRequested?.Invoke(Cursor.WithCount(leftover));
            Cursor = ItemStack.Empty;
            Changed?.Invoke();
        }
        _overlay.Visible = false;
        ((Stonewake.Game.Main)GetParent()).CloseInventory();
    }
    public void Refresh()
    {
        if (!IsOpen) return;
        _heading.Text = _mode switch { InventoryMode.Station => "CRAFTING STATION", InventoryMode.Chest => "STORAGE CHEST", InventoryMode.Furnace => "FURNACE", _ => "INVENTORY" };
        Populate(_backpack, _player.Slots, "bag", 9);
        Populate(_equipmentGrid, _player.Equipment, "equip", 2);
        var crafting = CraftingGrid();
        _craftGrid.Columns = crafting.Size == 9 ? 3 : 2;
        Populate(_craftGrid, crafting, "craft", _craftGrid.Columns);
        var recipe = RecipeBook.Match(crafting, _craftGrid.Columns, _mode == InventoryMode.Station);
        _recipe.Text = recipe == null ? (_mode == InventoryMode.Station ? "3×3 CRAFTING" : "2×2 PERSONAL CRAFTING")
            : $"READY: {ItemCatalog.Get(recipe.Output).Name} ×{recipe.Count}";
        _craftButton.Disabled = recipe == null;
        _storageGrid.Visible = _mode is InventoryMode.Chest or InventoryMode.Furnace;
        if (_mode == InventoryMode.Chest) { _storageGrid.Columns = 9; Populate(_storageGrid, _world.Chest(_cell), "storage", 9); }
        else if (_mode == InventoryMode.Furnace)
        {
            _storageGrid.Columns = 3; Populate(_storageGrid, _world.Furnace(_cell).Slots, "storage", 3);
            var furnace = _world.Furnace(_cell);
            _furnaceVisual = $"{furnace.Slots[0]}|{furnace.Slots[1]}|{furnace.Slots[2]}";
            _status.Text = $"Input  |  Fuel  |  Output     Heat {furnace.BurnRemaining:0.0}s  ·  Smelting {furnace.ProgressFraction:P0}";
        }
        else _status.Text = "Place matching materials in the grid, then craft.";
        _cursorLabel.Text = Cursor.IsEmpty ? "" : $"{ItemCatalog.Get(Cursor.Id).Name} ×{Cursor.Count}";
    }
    private InventoryGrid CraftingGrid() => _mode == InventoryMode.Station ? _world.Station(_cell) : _world.PersonalCraft;
    private void Populate(GridContainer host, InventoryGrid grid, string group, int columns)
    {
        foreach (var child in host.GetChildren()) { host.RemoveChild(child); child.QueueFree(); }
        for (var i = 0; i < grid.Size; i++)
        {
            var index = i;
            var stack = grid[i];
            var compact = group == "storage" && grid.Size == 27;
            var name = stack.IsEmpty ? "·" : ItemCatalog.Get(stack.Id).Name;
            var label = stack.IsEmpty ? name : compact ? $"{name[..Math.Min(2, name.Length)]}\n{stack.Count}" : $"{name}\n{stack.Count}";
            var button = new Button { Text = label, CustomMinimumSize = compact ? new Vector2(32, 36) : group == "bag" ? new Vector2(58, 56) : new Vector2(82, 54), ClipText = true };
            button.AddThemeFontSizeOverride("font_size", compact ? 10 : 12);
            button.TooltipText = stack.IsEmpty ? "Empty" : Tooltip(stack);
            button.GuiInput += input =>
            {
                if (input is InputEventMouseButton { Pressed: true } mouse && mouse.ButtonIndex is MouseButton.Left or MouseButton.Right)
                {
                    Click(group, index, mouse.ButtonIndex == MouseButton.Right);
                    button.AcceptEvent();
                }
            };
            host.AddChild(button);
        }
    }
    private static string Tooltip(ItemStack stack)
    {
        var item = ItemCatalog.Get(stack.Id);
        var durability = item.Durability > 0 ? $"\nDurability {item.Durability - stack.Damage}/{item.Durability} · Tier {item.Tier}" : "";
        return $"{item.Name} ×{stack.Count}\n{item.Description}{durability}";
    }
    private void ShowRecipe(int index)
    {
        var recipe = _shownRecipes[index];
        var materials = recipe.Inputs.Where(id => id != "").GroupBy(id => id)
            .Select(group => $"{ItemCatalog.Get(group.Key).Name} ×{group.Count()}");
        var pattern = recipe.Kind == "shaped"
            ? string.Join(" / ", Enumerable.Range(0, recipe.Width).Select(row => string.Join(" ",
                recipe.Inputs.Skip(row * recipe.Width).Take(recipe.Width).Select(id => id == "" ? "·" : ItemCatalog.Get(id).Name[..2]))))
            : "Any order";
        _guide.Text = $"{pattern}\n{string.Join(", ", materials)}";
    }
    private void Click(string group, int index, bool right)
    {
        var grid = group switch { "bag" => _player.Slots, "equip" => _player.Equipment, "craft" => CraftingGrid(), _ => _mode == InventoryMode.Chest ? _world.Chest(_cell) : _world.Furnace(_cell).Slots };
        if (group == "equip" && !Cursor.IsEmpty)
        {
            var id = Cursor.Id;
            var category = ItemCatalog.Get(id).Category;
            var valid = index switch { 0 => category is "pickaxe" or "shovel", 1 => id.EndsWith("_helmet"), 2 => id.EndsWith("_chestplate"), 3 => category == "weapon", _ => false };
            if (!valid) return;
        }
        if (group == "storage" && _mode == InventoryMode.Furnace && !Cursor.IsEmpty)
        {
            if (index == 2 || index == 1 && ItemCatalog.Get(Cursor.Id).FuelSeconds <= 0 ||
                index == 0 && RecipeBook.Smelt(Cursor.Id) == null) return;
        }
        Cursor = grid.Click(index, Cursor, right);
        Changed?.Invoke();
        Refresh();
    }
    private void Craft()
    {
        var grid = CraftingGrid();
        var recipe = RecipeBook.Match(grid, _craftGrid.Columns, _mode == InventoryMode.Station);
        if (RecipeBook.Craft(grid, _craftGrid.Columns, _mode == InventoryMode.Station, _player.Slots))
        { if (recipe != null) Crafted?.Invoke(recipe); Changed?.Invoke(); Refresh(); }
    }
    private void DropCursor()
    {
        if (Cursor.IsEmpty) return;
        DropRequested?.Invoke(Cursor);
        Cursor = ItemStack.Empty;
        Changed?.Invoke(); Refresh();
    }
}
