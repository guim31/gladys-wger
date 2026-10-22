# wger

[wger](https://wger.de) est un carnet d'entraînement et de suivi du poids libre (AGPL-3.0), utilisé sur wger.de ou auto-hébergé. Cette intégration amène votre compte wger dans Gladys : votre poids et sa tendance, vos séances de la semaine, les calories saisies aujourd'hui, des déclencheurs de scène, et une action de scène qui **ajoute une pesée dans wger** — une balance connectée déjà intégrée à Gladys peut ainsi alimenter wger.

Testée contre un vrai serveur wger en Docker (wger 2.8, la version de wger.de) : lecture, ajout de pesées, erreurs. Sans lien avec le projet wger.

## Prérequis

- Un compte wger, sur [wger.de](https://wger.de) ou sur votre propre serveur (wger 2.6 ou plus récent conseillé ; testé avec la 2.8).
- Sa **clé API** : dans wger, ouvrez le menu utilisateur, puis **Clé API**, et générez une clé (sur wger.de : <https://wger.de/fr/user/api-key>).
- Gladys Assistant 5.1 ou plus récent.

## Configuration

Dans Gladys, ouvrez **Intégrations → wger**, puis la configuration :

- **Adresse de wger** : `https://wger.de`, ou l'adresse de votre propre serveur (ex. `http://192.168.1.20:8000`). Une adresse copiée depuis le navigateur est acceptée.
- **Clé API** : la clé générée dans wger. Gladys la garde comme un secret, elle n'est jamais écrite dans les logs.
- **Intervalle de rafraîchissement** : 15 minutes, 30 minutes (par défaut) ou 1 heure. Une pesée ajoutée par une scène est relue tout de suite.
- **Langue des noms** : langue des noms de fonctionnalités (figés à l'ajout de l'appareil) et des textes envoyés aux scènes.

Le bouton **Tester la connexion** lit wger tout de suite et indique le compte connecté.

## L'appareil

Un appareil par compte, `wger <nom d'utilisateur>`, proposé dans l'onglet **Découverte**. Ajoutez-le pour obtenir ses fonctionnalités :

| Fonctionnalité                                            | Valeur                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Poids (kg) / Poids (lb)                                   | la dernière pesée, dans l'unité de votre profil wger               |
| Variation sur 7 jours (kg) / Variation sur 7 jours (lb)   | la dernière pesée moins celle d'il y a 7 jours, ou d'avant         |
| Variation sur 30 jours (kg) / Variation sur 30 jours (lb) | la même chose sur 30 jours                                         |
| IMC                                                       | quand votre taille est renseignée dans votre profil wger           |
| Jours depuis la dernière pesée                            | 0 le jour même                                                     |
| Séances cette semaine                                     | les séances depuis lundi                                           |
| Jours depuis la dernière séance                           | 0 le jour même                                                     |
| Dernière séance                                           | son jour, puis ses notes ou sa routine                             |
| Calories du jour (kcal)                                   | les aliments saisis aujourd'hui, si vous avez un plan nutritionnel |

Une variation n'est donnée que si wger a une pesée assez ancienne (au plus deux fois la période avant) : avec une pesée il y a un mois, pas de « variation sur 7 jours ».

Données de santé : les fonctionnalités ne gardent **aucun historique par défaut** (vous pouvez l'activer fonctionnalité par fonctionnalité dans Gladys), et aucune valeur n'est jamais écrite dans les logs.

## Widget

Le widget **Poids et séances** affiche le poids et sa variation sur 7 jours, les séances de la semaine, le jour de la dernière séance, les calories du jour (face à l'objectif du plan nutritionnel), la courbe du poids sur 30 jours, et un bouton **Actualiser**. Il fonctionne même avant l'ajout de l'appareil.

## Déclencheurs de scène

- **Nouvelle pesée** : une pesée plus récente que la dernière connue apparaît dans wger (appli, site, autre outil ; pas les pesées ajoutées par l'action de scène ci-dessous, qui donne ses propres résultats). Informations transmises : poids, unité, variation sur 7 jours, IMC, date.
- **Séance enregistrée** : une séance plus récente que la dernière connue apparaît dans wger. Informations transmises : notes ou routine, date, durée, séances cette semaine.
- **Aucune séance depuis un moment** : aucune séance depuis 2, 3, 5, 7 ou 14 jours (au choix). Une fois par seuil, jusqu'à la séance suivante. Informations transmises : jours depuis la dernière séance, sa date.

Les déclencheurs sont vus à la lecture suivante de wger (voir l'intervalle de rafraîchissement). La première lecture d'un compte n'annonce rien : seulement ce qui se passe après.

## Actions de scène

- **Ajouter une pesée** : ajoute un poids dans wger. Le poids est un nombre (`79,8` ou `79.8`) ou une valeur de la scène, par exemple le poids d'une balance connectée (insérez-la avec `{{`). La date est maintenant, sauf si vous la donnez (`2026-10-22` ou `22/10/2026`). Refusé, avec une ligne dans les logs de Gladys : ce qui n'est pas un nombre, un poids hors de 20–350 kg (44–770 lb), une date dans le futur et, sauf si vous décochez la case, un poids à plus de 10 % de la dernière pesée des 30 derniers jours (quelqu'un d'autre, ou le chat, sur la balance). Le même poids le même jour n'est pas ajouté deux fois. Résultats : ajoutée, poids, unité, date, variation sur 7 jours, message.
- **Lire le bilan de la semaine** : lit wger et donne le poids, ses variations, l'IMC, les séances de la semaine, la dernière séance, les calories du jour et une phrase toute faite aux actions suivantes.

## Exemples de scènes

- **La balance alimente wger** : déclencheur « la valeur d'un appareil change » sur le poids de votre balance connectée → action **Ajouter une pesée** avec cette valeur → un message avec le poids et sa variation sur 7 jours, donnés par l'action.
- **Un coup de pouce sur le canapé** : déclencheur **Aucune séance depuis un moment** (3 jours) → message « Pas de séance depuis 3 jours, un petit footing ? ».
- **Le bilan du dimanche soir** : déclencheur « chaque dimanche à 20 h » → **Lire le bilan de la semaine** → message avec sa phrase : « Poids 79,8 kg (-0,7 kg en 7 jours) · 2 séances cette semaine, dernière jeu. 22/10 ».

## Dépannage

- **Accès refusé : vérifiez la clé API** : générez une nouvelle clé dans wger et collez-la de nouveau (avec ou sans le mot « Token »).
- **wger ne répond pas** : vérifiez l'adresse, et que Gladys joint le serveur (pour un wger auto-hébergé, le port, ex. `:8000` ou `:80`).
- **L'adresse redirige** : donnez l'adresse en `https://` de votre serveur.
- **Pas de calories** : la fonctionnalité n'existe qu'avec un plan nutritionnel dans wger ; ce sont les calories des aliments saisis aujourd'hui.
- **Une pesée a été refusée** : la raison est dans les logs de Gladys ; décochez le contrôle des 10 % si votre poids a vraiment changé autant.
- Problèmes et idées : <https://github.com/guim31/gladys-wger/issues>.

## Limites

- Un compte wger par intégration. Pour deux personnes, il faut deux comptes wger (et l'installation de l'intégration en suit un).
- L'unité de poids est celle de votre profil wger ; la changer ajoute de nouvelles fonctionnalités dans l'autre unité (mettez l'appareil à jour depuis l'onglet Découverte).
- Lecture seule, sauf les pesées ajoutées par l'action de scène : aucune routine, aucun plan nutritionnel n'est modifié.
- Les calories du jour demandent une requête par aliment saisi la première fois (puis elles sont gardées) : un journal chargé se lit en quelques secondes.
- Le texte « Dernière séance » donne les notes de la séance, ou le nom de sa routine.
