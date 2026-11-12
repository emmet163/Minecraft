using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Stonewake.Items;

public sealed record RecipeDef(string Id, string Kind, int Width, string[] Inputs, string Output, int Count, bool Station);
public sealed record SmeltDef(string Input, string Output, float Seconds);

public static class RecipeBook
{
    private static readonly List<RecipeDef> Recipes = Load();
    private static readonly Dictionary<string, SmeltDef> Smelting = LoadSmelting();
    public static IReadOnlyList<RecipeDef> All => Recipes;
    public static SmeltDef? Smelt(string? input) => string.IsNullOrEmpty(input) ? null : Smelting.GetValueOrDefault(input);
    private static Dictionary<string, SmeltDef> LoadSmelting()
    {
        var assembly = typeof(RecipeBook).Assembly;
        var name = assembly.GetManifestResourceNames().Single(value => value.EndsWith("smelting.json", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(name)!;
        var entries = JsonSerializer.Deserialize<List<SmeltDef>>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        if (entries.Any(entry => !ItemCatalog.Exists(entry.Input) || !ItemCatalog.Exists(entry.Output) || entry.Seconds <= 0))
            throw new InvalidOperationException("Invalid smelting recipe");
        return entries.ToDictionary(entry => entry.Input, StringComparer.Ordinal);
    }
    private static List<RecipeDef> Load()
    {
        var assembly = typeof(RecipeBook).Assembly;
        var name = assembly.GetManifestResourceNames().Single(value => value.EndsWith("recipes.json", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(name)!;
        var recipes = JsonSerializer.Deserialize<List<RecipeDef>>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        foreach (var recipe in recipes)
        {
            if (!ItemCatalog.Exists(recipe.Output) || recipe.Inputs.Any(id => id != "" && !ItemCatalog.Exists(id)))
                throw new InvalidOperationException($"Unknown item in recipe {recipe.Id}");
            if (recipe.Kind == "shaped" && recipe.Inputs.Length != recipe.Width * recipe.Width)
                throw new InvalidOperationException($"Invalid shape in recipe {recipe.Id}");
        }
        return recipes;
    }
    public static RecipeDef? Match(InventoryGrid grid, int width, bool station)
    {
        foreach (var recipe in Recipes)
        {
            if (recipe.Station && !station || recipe.Width > width) continue;
            if (recipe.Kind == "shapeless")
            {
                var present = grid.Snapshot().Where(slot => !slot.IsEmpty).Select(slot => slot.Id).OrderBy(id => id).ToArray();
                if (present.SequenceEqual(recipe.Inputs.OrderBy(id => id))) return recipe;
            }
            else if (recipe.Kind == "shaped" && MatchShape(recipe, grid, width)) return recipe;
        }
        return null;
    }
    private static bool MatchShape(RecipeDef recipe, InventoryGrid grid, int width)
    {
        for (var offsetY = 0; offsetY <= width - recipe.Width; offsetY++)
        for (var offsetX = 0; offsetX <= width - recipe.Width; offsetX++)
        {
            var valid = true;
            for (var y = 0; y < width && valid; y++)
            for (var x = 0; x < width; x++)
            {
                var rx = x - offsetX; var ry = y - offsetY;
                var required = rx >= 0 && ry >= 0 && rx < recipe.Width && ry < recipe.Width
                    ? recipe.Inputs[ry * recipe.Width + rx] : "";
                if ((grid[y * width + x].IsEmpty ? "" : grid[y * width + x].Id) != required) { valid = false; break; }
            }
            if (valid) return true;
        }
        return false;
    }
    public static bool Craft(InventoryGrid grid, int width, bool station, InventoryGrid output)
    {
        var recipe = Match(grid, width, station);
        if (recipe == null) return false;
        var trial = new InventoryGrid(output.Size);
        trial.Load(output.Snapshot());
        if (trial.Add(recipe.Output, recipe.Count) > 0) return false;
        foreach (var stack in grid.Snapshot().Select((value, index) => (value, index)))
            if (!stack.value.IsEmpty) grid.Set(stack.index, stack.value.WithCount(stack.value.Count - 1));
        output.Load(trial.Snapshot());
        return true;
    }
}
