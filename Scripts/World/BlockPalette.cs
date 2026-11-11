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
            _ => new Color(0.45f, 0.47f, 0.49f)
        };

        for (var y = 0; y < 16; y++)
        for (var x = 0; x < 16; x++)
        {
            // Stable, hand-authored color pattern. No external art assets are needed.
            var noise = ((x * 37 + y * 57 + x * y * 13) % 17 - 8) / 100f;
            image.SetPixel(x, y, new Color(
                Mathf.Clamp(baseColor.R + noise, 0f, 1f),
                Mathf.Clamp(baseColor.G + noise, 0f, 1f),
                Mathf.Clamp(baseColor.B + noise, 0f, 1f)));
        }

        return new StandardMaterial3D
        {
            AlbedoTexture = ImageTexture.CreateFromImage(image),
            TextureFilter = BaseMaterial3D.TextureFilterEnum.Nearest,
            Roughness = 1f
        };
    }
}
