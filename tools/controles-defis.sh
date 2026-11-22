#!/usr/bin/env bash
# Les harnais des defis, chacun sur un worker local neuf : sur un worker partage,
# l'anti-abus par IP fabrique de faux echecs.
#   bash tools/controles-defis.sh               tous
#   bash tools/controles-defis.sh revanche-test ceux-la seulement
set -u
cd "$(dirname "$0")/.."

TESTS=(direct-couloirs-test direct-huit-test direct-presentation-test
  direct-revanche-accord-test direct-revanche-duel-test direct-tournoi-test
  revanche-test defi-plusieurs-test defi-camera-test relais-confrontation-test
  relais-defis-test relais-salle-test relais-vestiaire-test mot-direct-test
  mot-test boite-test classement-integration-test duels-disciplines-test
  serie-test reponse-perdant-test correctifs-21-10-test haies-serveur-test
  correctifs-serveur-22-11-test)
# shortcut: present seulement s'il existe, le rendre fixe une fois la PR 143 fusionnee.
[ -f tools/audit-duels-21-11-test.mjs ] && TESTS+=(audit-duels-21-11-test)
[ $# -gt 0 ] && TESTS=("$@")

# 8788 : plusieurs harnais l'ont en dur.
URL=http://127.0.0.1:8788
CLE=cle-de-test-locale-uniquement
ETAT=$(mktemp -d)
RESUME=${GITHUB_STEP_SUMMARY:-/dev/null}
serveur=''
arreter() { [ -n "$serveur" ] && kill "$serveur" 2>/dev/null && wait "$serveur" 2>/dev/null; serveur=''; }
trap 'arreter; rm -rf "$ETAT"' EXIT
repond() { curl -s -o /dev/null -m 2 "$URL/presence"; }

if repond; then echo "Le port 8788 est deja pris : rien n'a ete lance."; exit 1; fi

rates=0
for t in "${TESTS[@]}"; do
  journal="$ETAT/$t.log"
  (cd worker && exec ./node_modules/.bin/wrangler dev --local --port 8788 --ip 127.0.0.1 \
    --persist-to "$ETAT/$t" --var "ADMIN_CLE:$CLE") > "$journal.serveur" 2>&1 &
  serveur=$!
  for _ in $(seq 1 120); do repond && break; sleep .5; done

  if curl -fsS -m 30 -o /dev/null -X POST "$URL/test/admin/creer" -H "X-Sprinter-Admin: $CLE" \
    -H 'Content-Type: application/json' -d '{"nom":"harnais","code":"ECRAN1"}' 2> "$journal"; then
    ADMIN_CLE=$CLE BASE=$URL ACCES=ECRAN1 perl -e 'alarm 220; exec @ARGV or die' \
      node "tools/$t.mjs" > "$journal" 2>&1
    code=$?
  else
    code=1
  fi
  arreter
  for _ in $(seq 1 60); do repond || break; sleep .5; done

  # Le code de sortie ne suffit pas : un harnais plante a deja compte « 0 ✗ ».
  if [ "$code" = 0 ] && ! grep -q '✗' "$journal" && grep -q '✓' "$journal"; then
    echo "OK    $t"
    echo "- ✅ $t" >> "$RESUME"
  else
    rates=$((rates + 1))
    echo "ECHEC $t (code $code)"
    grep '✗' "$journal"
    tail -n 30 "$journal"
    tail -n 15 "$journal.serveur"
    [ -n "${GITHUB_ACTIONS:-}" ] && echo "::error title=Harnais en echec::$t"
    echo "- ❌ $t" >> "$RESUME"
  fi
done

echo "$((${#TESTS[@]} - rates)) harnais sur ${#TESTS[@]} passent."
echo "**$((${#TESTS[@]} - rates)) harnais sur ${#TESTS[@]} passent.**" >> "$RESUME"
[ "$rates" = 0 ]
