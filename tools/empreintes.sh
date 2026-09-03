#!/bin/sh
# Recalcule le manifeste d'empreintes qui accompagne la lettre scellee.
#
# La lettre (juridique/lettre-scellee.md) ne cree aucun droit : le droit
# d'auteur nait sans depot. Elle DATE. Et ce qu'elle date, ce sont ces
# empreintes-la : une par fichier versionne, plus une empreinte globale du
# manifeste entier. Changer un caractere dans n'importe quel fichier change
# l'empreinte globale — c'est tout le mecanisme.
#
# D'ou l'importance de le rejouer AVANT de sceller : un manifeste vieux de
# trois jours ne date pas le travail de ces trois jours, et ce qui n'y figure
# pas n'est pas date.
#
#     sh tools/empreintes.sh
#
# Ecrit juridique/empreintes.txt (les empreintes, sans en-tete, pour rester
# verifiable par la commande que la lettre publie) et juridique/instantane.md
# (ce que ce manifeste couvre, et l'empreinte globale a reporter dans la
# lettre).
#
# Les empreintes portent sur les fichiers TELS QU'ILS SONT SUR LE DISQUE, pas
# sur le contenu du dernier commit — c'est l'etat que la lettre decrit. Quand
# les deux different, `instantane.md` le dit, fichier par fichier.
set -e

cd "$(dirname "$0")/.."
MANIFESTE=juridique/empreintes.txt
INSTANTANE=juridique/instantane.md

# Exactement la commande que publie la lettre, pour que la verification par un
# tiers redonne le meme resultat. `git ls-files` ne rend que les fichiers
# versionnes : ni node_modules, ni dist, ni les secrets ignores.
git ls-files | sort | while read -r f; do
  [ -f "$f" ] && shasum -a 256 "$f"
done > "$MANIFESTE"

GLOBALE=$(shasum -a 256 "$MANIFESTE" | cut -d' ' -f1)
NB=$(wc -l < "$MANIFESTE" | tr -d ' ')
BRANCHE=$(git branch --show-current)
TETE=$(git rev-parse HEAD)
QUAND=$(date '+%d/%m/%Y a %Hh%M')
SALES=$(git status --porcelain --untracked-files=no | awk '{print $2}' | sort)

{
  echo "# INSTANTANÉ DU MANIFESTE D'EMPREINTES"
  echo
  echo "Établi le **$QUAND** par \`tools/empreintes.sh\`."
  echo
  echo "| Élément | Valeur |"
  echo "|---|---|"
  echo "| Branche | \`$BRANCHE\` |"
  echo "| Commit courant (\`HEAD\`) | \`$TETE\` |"
  echo "| Fichiers versionnés | **$NB** |"
  echo "| Manifeste | \`$MANIFESTE\` |"
  echo "| **SHA-256 du manifeste complet** | **\`$GLOBALE\`** |"
  echo
  echo "C'est cette empreinte globale qu'il faut reporter à l'annexe A de la"
  echo "lettre scellée, en remplacement de la précédente."
  echo
  echo "## Vérification par un tiers"
  echo
  echo "\`\`\`"
  echo "git ls-files | sort | while read f; do shasum -a 256 \"\$f\"; done | shasum -a 256"
  echo "\`\`\`"
  echo
  echo "Doit rendre \`$GLOBALE\`."
  echo

  if [ -n "$SALES" ]; then
    NBS=$(printf '%s\n' "$SALES" | wc -l | tr -d ' ')
    echo "## Écart entre le disque et le commit"
    echo
    echo "Les empreintes portent sur l'état **sur disque**. À cet instant,"
    echo "**$NBS fichiers** y diffèrent de \`$TETE\` : leur empreinte ne se"
    echo "retrouve donc pas en rejouant le manifeste depuis le commit seul."
    echo "C'est l'état sur disque qui fait foi, et c'est lui que la lettre"
    echo "décrit."
    echo
    printf '%s\n' "$SALES" | sed 's/^/- `/; s/$/`/'
    echo
    echo "> Pour un instantané parfaitement reproductible depuis la seule"
    echo "> gestion de version : valider ces fichiers, puis rejouer ce script."
  else
    echo "## Écart entre le disque et le commit"
    echo
    echo "Aucun. Le disque est identique à \`$TETE\` : le manifeste se rejoue à"
    echo "l'identique depuis la gestion de version seule."
  fi
} > "$INSTANTANE"

echo "$NB fichiers empreints dans $MANIFESTE"
echo "empreinte globale : $GLOBALE"
echo "instantané écrit dans $INSTANTANE"
