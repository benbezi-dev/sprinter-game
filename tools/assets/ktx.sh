#!/usr/bin/env bash
# LES OUTILS KTX DE KHRONOS (toktx, ktx), POUR LES TEXTURES COMPRESSEES DU GPU (KTX2/Basis)
#
#   tools/assets/ktx.sh toktx --version
#   tools/assets/ktx.sh ktx create --encode uastc ... entree.png sortie.ktx2
#
# Au premier appel, telecharge la version officielle Linux x86_64 de KTX-Software
# depuis les releases GitHub de KhronosGroup et la range hors du depot
# (~/.cache/ktx-software-<version>) ; l'empreinte SHA-256 de l'archive est verifiee.
# Sur Mac : Homebrew n'a pas de paquet KTX ; bash /Volumes/MUSIQUE/BENBEZI/claude-commun/installer-ktx-mac.sh
# (.pkg officiel Khronos, sans sudo). Ce script-ci ne sert que sous Linux.
set -euo pipefail
VERSION=4.4.2
# Empreinte relevee au premier telechargement (10/11/2026), depuis l'URL ci-dessous.
SHA256=a8781bad05f9624edbf910b7f258cd0a4ba7d3e63b49ecc0a0ab440bf6a0a245
DOSSIER="${HOME}/.cache/ktx-software-${VERSION}"
URL="https://github.com/KhronosGroup/KTX-Software/releases/download/v${VERSION}/KTX-Software-${VERSION}-Linux-x86_64.tar.bz2"
if [ ! -x "${DOSSIER}/bin/toktx" ]; then
  tmp="$(mktemp -d)"
  curl -sSfL -o "${tmp}/ktx.tar.bz2" "${URL}"
  echo "${SHA256}  ${tmp}/ktx.tar.bz2" | sha256sum -c --quiet -
  mkdir -p "${DOSSIER}"
  tar -xjf "${tmp}/ktx.tar.bz2" -C "${DOSSIER}" --strip-components=1
  rm -rf "${tmp}"
fi
outil="$1"; shift
case "${outil}" in toktx|ktx) ;; *) echo "outil inconnu : ${outil} (toktx ou ktx)" >&2; exit 2 ;; esac
LD_LIBRARY_PATH="${DOSSIER}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}" exec "${DOSSIER}/bin/${outil}" "$@"
