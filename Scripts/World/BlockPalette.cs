using Godot;

namespace Stonewake.World;

public static class BlockPalette
{
    public static StandardMaterial3D Create(BlockType type)
    {
        var image = Image.CreateEmpty(16, 16, false, Image.Format.Rgba8);
        var baseColor = type switch
        {
            BlockType.Grass => new Color(0.34f, 0.59f, 0.24f),
            BlockType.Dirt => new Color(0.42f, 0.28f, 0.17f),
            BlockType.Stone => new Color(0.45f, 0.47f, 0.49f),
            BlockType.Sand => new Color(0.78f, 0.70f, 0.48f),
            BlockType.Snow => new Color(0.84f, 0.91f, 0.94f),
            BlockType.Mud => new Color(0.29f, 0.31f, 0.22f),
            BlockType.Water => new Color(0.11f, 0.36f, 0.68f, 0.78f),
            BlockType.Wood => new Color(0.43f, 0.30f, 0.18f),
            BlockType.Leaves => new Color(0.21f, 0.46f, 0.20f),
            BlockType.Flower => new Color(0.91f, 0.37f, 0.44f),
            BlockType.Plant => new Color(0.35f, 0.64f, 0.23f),
            BlockType.Coal => new Color(0.18f, 0.19f, 0.20f),
            BlockType.Copper => new Color(0.66f, 0.37f, 0.22f),
            BlockType.Iron => new Color(0.66f, 0.61f, 0.52f),
            BlockType.Gold => new Color(0.83f, 0.64f, 0.20f),
            BlockType.GrassSide => new Color(0.39f, 0.29f, 0.18f),
            BlockType.SnowSide => new Color(0.44f, 0.47f, 0.49f),
            BlockType.Gravel => new Color(0.49f, 0.48f, 0.45f),
            BlockType.Glass => new Color(0.64f, 0.85f, 0.91f),
            BlockType.Slab => new Color(0.55f, 0.55f, 0.54f),
            BlockType.Stairs => new Color(0.48f, 0.34f, 0.21f),
            BlockType.Door => new Color(0.52f, 0.32f, 0.17f),
            BlockType.Fence => new Color(0.49f, 0.32f, 0.19f),
            BlockType.CraftingStation => new Color(0.56f, 0.38f, 0.20f),
            BlockType.Furnace => new Color(0.36f, 0.38f, 0.40f),
            BlockType.Chest => new Color(0.62f, 0.39f, 0.17f),
            _ => new Color(1f, 0f, 1f)
        };

        for (var y = 0; y < 16; y++)
        for (var x = 0; x < 16; x++)
        {
            // Stable, hand-authored color pattern. No external art assets are needed.
            var noise = ((x * 37 + y * 57 + x * y * 13) % 17 - 8) / 100f;
            var tint = type == BlockType.GrassSide && y < 3 ? new Color(.34f, .59f, .24f)
                     : type == BlockType.SnowSide && y < 3 ? new Color(.84f, .91f, .94f)
                     : baseColor;
            image.SetPixel(x, y, new Color(
                Mathf.Clamp(tint.R + noise, 0f, 1f),
                Mathf.Clamp(tint.G + noise, 0f, 1f),
                Mathf.Clamp(tint.B + noise, 0f, 1f)));
        }

        var material = new StandardMaterial3D
        {
            AlbedoTexture = ImageTexture.CreateFromImage(image),
            TextureFilter = BaseMaterial3D.TextureFilterEnum.Nearest,
            CullMode = BaseMaterial3D.CullModeEnum.Disabled,
            Roughness = 1f
        };
        if (type is BlockType.Water or BlockType.Glass)
        {
            material.Transparency = BaseMaterial3D.TransparencyEnum.Alpha;
            material.AlbedoColor = new Color(1f, 1f, 1f, type == BlockType.Glass ? .48f : .78f);
        }
        return material;
    }
}
