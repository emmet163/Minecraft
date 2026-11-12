using System;
using Godot;

namespace Stonewake.Game;

public static class SoundEffects
{
    public static AudioStreamWav Thunder()
    {
        const int rate = 22050;
        var count = rate * 2;
        var data = new byte[count * 2];
        var random = new Random(5521);
        var low = 0f;
        for (var i = 0; i < count; i++)
        {
            low = low * .94f + ((float)random.NextDouble() * 2 - 1) * .06f;
            var envelope = MathF.Pow(1f - i / (float)count, 1.6f);
            var sample = (short)(Math.Clamp(low * envelope, -1f, 1f) * 19000);
            data[i * 2] = (byte)(sample & 255);
            data[i * 2 + 1] = (byte)((sample >> 8) & 255);
        }
        return new AudioStreamWav { Data = data, Format = AudioStreamWav.FormatEnum.Format16Bits, MixRate = rate, Stereo = false };
    }
    public static AudioStreamWav Make(bool breaking)
    {
        const int rate = 22050;
        var count = breaking ? 3300 : 2200;
        var data = new byte[count * 2];
        var random = new Random(breaking ? 1703 : 2909);
        for (var i = 0; i < count; i++)
        {
            var t = i / (float)rate;
            var envelope = MathF.Pow(1f - i / (float)count, breaking ? 1.3f : 2f);
            var tone = MathF.Sin(2f * MathF.PI * (breaking ? 125f - t * 300f : 320f - t * 750f) * t);
            var noise = (float)(random.NextDouble() * 2 - 1);
            var sample = (short)(Math.Clamp((tone * .28f + noise * .5f) * envelope, -1f, 1f) * 10000);
            data[i * 2] = (byte)(sample & 255);
            data[i * 2 + 1] = (byte)((sample >> 8) & 255);
        }
        return new AudioStreamWav
        {
            Data = data,
            Format = AudioStreamWav.FormatEnum.Format16Bits,
            MixRate = rate,
            Stereo = false
        };
    }
}
