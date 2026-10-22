#!/bin/sh
# Makes the companion pictures (PROJECT.md 2.4) from the films in server/media/: a square
# portrait per character and a still per chapter. Run from server/ after converting the films.
# The pictures are stills from the films (CC BY 3.0, credited in the README) and are not committed.
set -e
M=media
out() { mkdir -p "$M/companion/$1"; }
portrait() { # film time size x y name [extra filter]
  ffmpeg -loglevel error -y -ss "$2" -i "$M/$1.mp4" -frames:v 1 \
    -vf "crop=$3:$3:$4:$5,scale=320:320${7:+,$7}" -q:v 3 "$M/companion/$1/$6.jpg"
}
still() { # film name time
  ffmpeg -loglevel error -y -ss "$3" -i "$M/$1.mp4" -frames:v 1 \
    -vf "crop=ih*16/9:ih,scale=640:360" -q:v 4 "$M/companion/$1/$2.jpg"
}

# Tears of Steel is 1280 x 534 (2.39:1) after the conversion; the stills are 16:9 crops.
out tears-of-steel
i=1; for t in 28 83 226 300 383 518; do still tears-of-steel "chapter-$i" "$t"; i=$((i + 1)); done

# Sintel is 1694 x 720 after the conversion in PROJECT.md 5.6.
out sintel
portrait sintel 120 480 686 40 sintel
portrait sintel 448 520 825 60 shaman "eq=gamma=1.4"
portrait sintel 216 440 290 280 scales
portrait sintel 504 640 540 0 cave-dragon "eq=gamma=1.5"
i=1; for t in 36 112 216 300 360 448 506 625 720; do still sintel "chapter-$i" "$t"; i=$((i + 1)); done
echo "Companion pictures written to $M/companion/"
