// Ce que partagent les ecrans de la Legende (Legende.tsx) et ses
// cinematiques (LegendeCinematiques.tsx) : les portraits des boss et la
// couleur de chaque etape. Canal de test seulement, comme eux.

// LES PORTRAITS DES BOSS, rendus de leur maillage par vedette_tripo.py.
import kouassiBuste from '@/assets/legende/boss/kouassi-buste.webp?url';
import damionBuste from '@/assets/legende/boss/damion-buste.webp?url';
import keremBuste from '@/assets/legende/boss/kerem-buste.webp?url';
import zenithBuste from '@/assets/legende/boss/zenith-buste.webp?url';
import wukongBuste from '@/assets/legende/boss/wukong-buste.webp?url';
import anansiBuste from '@/assets/legende/boss/anansi-buste.webp?url';
import soraBuste from '@/assets/legende/boss/sora-buste.webp?url';
import marcBuste from '@/assets/legende/boss/marc-buste.webp?url';
import yassineBuste from '@/assets/legende/boss/yassine-buste.webp?url';
import theoBuste from '@/assets/legende/boss/theo-buste.webp?url';
import jaydenBuste from '@/assets/legende/boss/jayden-buste.webp?url';
import oliverBuste from '@/assets/legende/boss/oliver-buste.webp?url';
import hermesBuste from '@/assets/legende/boss/hermes-buste.webp?url';
import intiBuste from '@/assets/legende/boss/inti-buste.webp?url';
import chidiBuste from '@/assets/legende/boss/chidi-buste.webp?url';

export const PORTRAITS: Record<string, string> = {
  'Kouassi': kouassiBuste, 'Damion Clarke': damionBuste, 'Kerem Aydın': keremBuste, 'Zénith': zenithBuste,
  'Sun Wukong': wukongBuste, 'Anansi': anansiBuste,
  'Sora Kanzaki': soraBuste, 'Marc Puig': marcBuste, 'Yassine Benali': yassineBuste,
  'Théo Garnier': theoBuste, 'Jayden Brooks': jaydenBuste, 'Oliver Hart': oliverBuste,
  'Hermès': hermesBuste, 'Inti': intiBuste, 'Chidi Okafor': chidiBuste,
};

/** La couleur de chaque etape : le soleil de la plage, le vermillon des torii,
 *  la terre cuite du national, le bleu du mondial, l'or de l'Olympe, le violet
 *  de l'apotheose. */
export const TEINTES = ['#F6C343', '#E5482E', '#D9822B', '#2F7BE0', '#E8B84A', '#9B6BFF'];
