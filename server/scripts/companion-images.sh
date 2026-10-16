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

out big-buck-bunny
portrait big-buck-bunny 18 440 440 80 bird
portrait big-buck-bunny 96 460 140 100 bunny
portrait big-buck-bunny 120 440 110 140 flying-squirrel
portrait big-buck-bunny 120 400 390 0 red-squirrel
portrait big-buck-bunny 120 440 630 200 chinchilla
portrait big-buck-bunny 78 420 330 0 pink-butterfly
portrait big-buck-bunny 108 360 340 0 purple-butterfly
i=1; for t in 60 78 120 230 270 348 430 474; do still big-buck-bunny "chapter-$i" "$t"; i=$((i + 1)); done

# Sintel is 1694 x 720 after the conversion in PROJECT.md 5.6.
out sintel
portrait sintel 120 480 686 40 sintel
portrait sintel 448 520 825 60 shaman "eq=gamma=1.4"
portrait sintel 216 440 290 280 scales
portrait sintel 504 640 540 0 cave-dragon "eq=gamma=1.5"
i=1; for t in 36 112 216 300 360 448 506 625 720; do still sintel "chapter-$i" "$t"; i=$((i + 1)); done
echo "Companion pictures written to $M/companion/"
