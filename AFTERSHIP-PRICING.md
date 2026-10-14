# API de suivi des colis : coûts et choix retenu

**Mis à jour le 14 octobre 2026.** Les offres et tarifs des fournisseurs peuvent évoluer.

## Décision actuelle

L’application utilise le widget Parcel App et conserve les colis dans le stockage local du navigateur. Elle n’appelle pas l’API AfterShip, ne transmet aucun numéro de suivi à AfterShip et n’envoie pas de notifications de changement de statut.

L’accès à l’API AfterShip a été annoncé à **70 $** lors de la consultation du compte. La périodicité et les quotas associés restent à confirmer directement avec AfterShip ; ce document ne présente pas ce montant comme un tarif public vérifié.

## Alternatives examinées

- **Ship24** annonce gratuitement son service de suivi grand public. Cela ne signifie pas que son API soit gratuite : sa documentation API indique qu’un abonnement « per-call » actif est requis pour l’utiliser. Aucun tarif API suffisamment clair n’a été vérifié ici pour conclure qu’il serait moins cher qu’AfterShip.
- Les intégrations directes avec des transporteurs peuvent éviter un agrégateur payant pour certains colis, mais elles ne fournissent pas une API unique couvrant tous les transporteurs et nécessitent une intégration différente par service.
- Aucun remplaçant universel avec API, webhooks et quota gratuit clairement vérifié n’a été retenu. Le choix le plus prévisible sans frais API est donc de garder le widget Parcel App tel quel.

## Coûts Cloudflare

Le site déployé est principalement statique. Les limites ou tarifs Cloudflare éventuellement applicables dépendent du compte et de son utilisation globale ; le choix de ne pas appeler AfterShip ne supprime pas les coûts habituels du nom de domaine ou d’autres services déjà utilisés sur le compte.

Une base D1 européenne créée uniquement pour le prototype AfterShip a été supprimée lorsque cette intégration a été abandonnée. Aucun secret AfterShip, Turnstile, webhook ou Web Push n’a été configuré.

## Limites du suivi sans API

Le widget Parcel App permet de consulter les informations disponibles chez Parcel App, mais l’application ne peut pas lire automatiquement le contenu de son iframe externe pour détecter les changements. En conséquence, les notifications automatiques quand le site est fermé ne sont pas disponibles sans API de suivi ou intégration directe avec les transporteurs.

## Sources consultées

- [AfterShip — tarification Tracking](https://www.aftership.com/pricing/tracking)
- [Ship24 — suivi grand public et offres](https://www.ship24.com/pricing)
- [Ship24 — documentation API per-call](https://docs.ship24.com/per-call-api)
- [Ship24 — documentation API](https://docs.ship24.com/)
