import subprocess
import os

os.makedirs("public", exist_ok=True)
font_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# 1. Create individual speech utterance (1.0 sec target)
# We can use flite with atempo to fit nicely into ~0.9-1.0s
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "flite=text='sheild activate'",
    "-filter:a", "apad=whole_dur=1.0,atrim=0:1.0",
    "/tmp/utterance.wav"
], check=True)

# 2. Create 0.5s silence
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
    "-t", "0.5",
    "/tmp/silence.wav"
], check=True)

# 3. Concatenate 8 cycles of (1.0s utterance + 0.5s silence) = 12 seconds total
with open("/tmp/concat_list.txt", "w") as f:
    for _ in range(8):
        f.write("file '/tmp/utterance.wav'\n")
        f.write("file '/tmp/silence.wav'\n")

subprocess.run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "/tmp/concat_list.txt",
    "-c:a", "aac", "-b:a", "128k",
    "/tmp/guide_audio.m4a"
], check=True)

# 4. Generate visual presentation video with drawtext
# Dynamic visual cues based on mod(t, 1.5):
# When mod(t, 1.5) < 1.0: "SPEAK NOW: 'Shield Activate' (1.0s window)" (Green badge)
# When mod(t, 1.5) >= 1.0: "PAUSE / SILENCE (0.5s pause)" (Amber badge)

drawtext_filters = [
    # Top title
    f"drawtext=fontfile='{font_path}':text='RECORDING REFERENCE GUIDE':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=35",
    f"drawtext=fontfile='{font_path}':text='Target Phrase\\: \"Sheild Activate\"':fontcolor='#38bdf8':fontsize=38:x=(w-text_w)/2:y=80",
    
    # Subtitle instructions
    f"drawtext=fontfile='{font_path}':text='Timing\\: Speak for 1.0s  |  Pause for 0.5s  |  Repeat':fontcolor='#cbd5e1':fontsize=20:x=(w-text_w)/2:y=135",

    # Status Box Container background
    "drawbox=x=80:y=180:w=640:h=180:color='#1e293b':t=fill",
    "drawbox=x=80:y=180:w=640:h=180:color='#475569':t=2",

    # Conditional state text: SPEAKING (t % 1.5 < 1.0)
    f"drawtext=fontfile='{font_path}':text='[ SPEAKING WINDOW (1.0s) ]':fontcolor='#4ade80':fontsize=22:x=(w-text_w)/2:y=205:enable='lt(mod(t,1.5),1.0)'",
    f"drawtext=fontfile='{font_path}':text='>>> \"Sheild Activate\" <<<':fontcolor='#22c55e':fontsize=36:x=(w-text_w)/2:y=245:enable='lt(mod(t,1.5),1.0)'",
    f"drawtext=fontfile='{font_path}':text='Say phrase clearly into microphone':fontcolor='#94a3b8':fontsize=16:x=(w-text_w)/2:y=305:enable='lt(mod(t,1.5),1.0)'",

    # Conditional state text: PAUSE (t % 1.5 >= 1.0)
    f"drawtext=fontfile='{font_path}':text='[ PAUSE / SILENCE (0.5s) ]':fontcolor='#fbbf24':fontsize=22:x=(w-text_w)/2:y=205:enable='gte(mod(t,1.5),1.0)'",
    f"drawtext=fontfile='{font_path}':text='... ( 0.5s Quiet ) ...':fontcolor='#f59e0b':fontsize=36:x=(w-text_w)/2:y=245:enable='gte(mod(t,1.5),1.0)'",
    f"drawtext=fontfile='{font_path}':text='Keep silent before next repetition':fontcolor='#94a3b8':fontsize=16:x=(w-text_w)/2:y=305:enable='gte(mod(t,1.5),1.0)'",

    # Progress bar and timeline at bottom
    "drawbox=x=80:y=390:w=640:h=16:color='#334155':t=fill",
    "drawbox=x=80:y=390:w='min(640, (t/12.0)*640)':h=16:color='#3b82f6':t=fill",
    f"drawtext=fontfile='{font_path}':text='Repetition Cadence Timer\\: %{{pts\\:hms}} / 00\\:00\\:12':fontcolor='#94a3b8':fontsize=16:x=(w-text_w)/2:y=420",
]

filter_complex = ",".join(drawtext_filters)

subprocess.run([
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "color=c=#0f172a:s=800x470:r=30",
    "-i", "/tmp/guide_audio.m4a",
    "-vf", filter_complex,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
    "-c:a", "copy",
    "-t", "12",
    "public/reference_guide.mp4"
], check=True)

print("Video generated successfully at public/reference_guide.mp4")
