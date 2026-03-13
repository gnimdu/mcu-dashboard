je souhaite créer une interface web statique, moderne et professionnel afin de realiser des fonctionnalités similaires à celle de STM32CubeIDE ou Sysconfig de Texas Instruments. Chaque fabriquant fournit des outils graphiques permettant de configurer et de visualiser les fonctionnalités de leur microprocesseurs et carte de developpement.
Les fonctionnalités principale qui nous interessent en priorité sont : 
- la configuration et la gestion interactive du pinout, 
- la configuration et la visualisation des horloges
- la configuration et la gestion des ressources
- un tableau de bord

l'objectif n'est pas de remplacer les environnements de développement des fabricant avec la génération automatique de code et le débogage ou encore toutes les fonctionnalités avancées.

On souhaite surtout visualiser configurer et exporter des rapports de configuration.

le point critique du projet est le pre-traitement des données fabricant afin d'extraire les données pour notre interface. ces fichiers constitue la source de vérité. 

Il s'agit en général de fichier constructeur (datasheet+erratum ou resource en ligne). les formats possibles sont donc : 
- pdf
- excel
- page html

il faut donc une stratégie robuste pour gérer le prétraitement et l'extraction de données à partir de ces différentes source possible. Etant données la nature heterogene des données fabricant et sachant que l'on souhaite une approche qui soit fabricant-agnostique,il faudrait un workflow flexible mais pas complexe en terme d'infrastructure.

un exemple d'usage peut ressembler a ça : 
```
on souhaite travailler un microcontroller de Texas Instruments F28388D par exemple.
A partir de la dernière version de la datasheet disponible sur le site de TI sous forme de pdf, on procède à l'extraction des données relatives aux ressources et au pin mapping. ces données extraites sont utilisées pour afficher un visuelle interactif avec lequel l'utilisateur peut travailler. Soit il souhaite uniquement avoir une vue spatiale des pins pour se réperer sur le micro à sa disposition, soit il commence le design d'une nouvelle carte et gère la selction des pins et la configuration des periphériques à utiliser. Danc=s ce dernier cas l'outil l'informe sur les ressources disponibles et celle déja utilisé. c'est une aide crucial au développement. 
De la même façon un autre utilisateur peut souhaiter faire la même chose mais cette fois avec une controCard ou un Launchpad. l'interface s'adapte à ce nouveau besoin. il peut facilement identifier les pins configurer et utilisable avec leur caractéristique. il peut aussi visualiser l'architecture d'horloge. 
```

A partir de ces éléments et les 2 captures d'écran fourni à titre indicatif ainsi que quelques élements de design pour inspiration dans le repertoire Inspiration, peux-tu plannifier et implémenter ce projet. procède de façon méthodique en initialisant un depot git à l'aide de github cli, puis mene des recherches détaillées, construit un plan d'implementation et maintient un fichier de suivi d'implémentation et un fichier de tracking.
Pour la partie ingestion des fichiers excel et pdf, je suggère l'utilisation de docling. voic un projet dans lequel docling est utilisé pou l'ingestion dans le cadre d'un workflow de RAG : "C:\Users\gnimd\Documents\AI_tool_test\Cole_mongoDB_RAG_agent\MongoDB-RAG-Agent_V4".
tu peux-t'en inspirer et l'adapté. je pense qu'il il y a la possiblité de construire un skill Claude sur la base de ce projet afin de gérer l'ingestion. ceci est une suggestion, explore aussi de potentiel solution qui pourraient être plus interessantes.