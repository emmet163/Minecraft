using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Stonewake.World;

namespace Stonewake.Items;

public sealed record ItemDef(string Id, string Name, int Stack, string Category, string? Block,
    int Durability, int Tier, float Speed, float FuelSeconds, string Description,
    int Nutrition = 0, float SaturationGain = 0, int Healing = 0);

public static class ItemCatalog
{
    private static readonly Dictionary<string, ItemDef> Definitions = Load();
    public static IEnumerable<ItemDef> All => Definitions.Values;
    public static ItemDef Get(string id) => Definitions.TryGetValue(id, out var item)
        ? item : throw new ArgumentException($"Unknown item: {id}");
    public static bool Exists(string id) => Definitions.ContainsKey(id);
    public static string ForBlock(BlockType block) => block == BlockType.CraftingStation
        ? "crafting_station" : block.ToString().ToLowerInvariant();
    public static BlockType BlockOf(string id)
    {
        var name = Get(id).Block;
        return name != null && Enum.TryParse<BlockType>(name, true, out var block) ? block : BlockType.Air;
    }
    private static Dictionary<string, ItemDef> Load()
    {
        var assembly = typeof(ItemCatalog).Assembly;
        var resource = assembly.GetManifestResourceNames().Single(name => name.EndsWith("items.json", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(resource)!;
        var entries = JsonSerializer.Deserialize<List<ItemDef>>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        return entries.ToDictionary(item => item.Id, StringComparer.Ordinal);
    }
}
