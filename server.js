// Importation des modules nécessaires
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var mongoose = require('mongoose');
const socketIO = require('socket.io');
const io = socketIO(server);
var path = require('path');

// Connexion à la base de données MongoDB
const ObjectId = mongoose.Types.ObjectId;
mongoose.connect('mongodb://localhost:27017/chat')
  .then(() => {
    console.log('Connexion à la base de données réussie');
  })
  .catch((err) => {
    console.error('Erreur de connexion à la base de données :', err);
  });

// Importation des modèles MongoDB
require('./models/utilisateurs.model');
require('./models/amis.model');
require('./models/message.model');

// Création des instances des modèles
var mess = mongoose.model("message");
var Utilisateurs = mongoose.model("utilisateurs");
var am = mongoose.model("amis");

// Configuration d'Express
app.use(express.static(__dirname + '/frontend'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route principale
app.get('/', async function(req, res) {
    try {
        // Récupération des utilisateurs et des salons (rooms) depuis la base de données
        const utilisateurs = await Utilisateurs.find();
        const rooms = await am.find().exec();

        // Création de l'objet de données à envoyer à la vue
        const data = {
            utilisateurs: utilisateurs.length > 0 ? utilisateurs : null,
            channels: rooms,
        };

        // Rendu de la vue avec les données
        res.render('index.ejs', data);
    } catch (err) {
        console.error('Erreur lors de la recherche des utilisateurs ou des rooms :', err);
        res.status(500).send('Erreur interne du serveur');
    }
});

// Middleware pour gérer les erreurs 404
app.use(function(req, res, next) {
    res.setHeader('Content-type', 'text/html');
    res.status(404).send('Page introuvable ! ');
});

// Tableau pour stocker les utilisateurs connectés
var connectedUsers = [];

// Gestionnaire d'événement lorsqu'un utilisateur se connecte au socket
io.on('connection', async (socket) => {

    socket.on('newUser', async (pseudo) => {
        try {
          console.log('Nouvel utilisateur connecté avec le pseudo :', pseudo);
          const utilisateur = await Utilisateurs.findOne({ pseudo: pseudo }).exec();
    
          if (utilisateur) {
            socket.pseudo = pseudo;
            socket.broadcast.emit('newUser', pseudo);
    
            // Émettre un événement 'welcome' avec le pseudo
            socket.emit('welcome', pseudo);
          } else {
            const newUser = new Utilisateurs({ pseudo: pseudo });
            const savedUser = await newUser.save();
            console.log('Nouvel utilisateur enregistré :', savedUser);
            socket.pseudo = pseudo;
            socket.broadcast.emit('newUser', pseudo);
    
            // Émettre un événement 'welcome' avec le pseudo
            socket.emit('welcome', pseudo);
          }
          _joinRoom('salon1');
    
          connectedUsers.push(socket);
    
        } catch (err) {
          console.error('Erreur lors de la recherche ou de l\'enregistrement de l\'utilisateur :', err);
        }
      });

    // Gestionnaire d'événement lorsqu'un utilisateur demande ses anciens messages privés
    socket.on('ancienwhispers', async (pseudo) => {
        try {
            // Récupérer les messages privés de l'utilisateur depuis la base de données
            const messages = await mess.find({ receveur: pseudo }).exec();
            // Émettre les anciens messages privés à l'utilisateur concerné
            socket.emit('ancienwhispers', messages);
        } catch (err) {
            console.error('Erreur lors de la recherche des messages :', err);
        }
    });

    // Gestionnaire d'événement lorsqu'un utilisateur envoie un nouveau message
    socket.on('newMessage', async (message, receveur) => {
        if (receveur === 'all') {
            // Message public, sauvegarder dans la base de données et informer les autres utilisateurs du salon
            var msg = new mess();
            msg._id_room= socket.channel;
            msg.content = message;
            msg.sender = socket.pseudo;
            msg.receveur = 'all';
            await msg.save();
            socket.broadcast.to(socket.channel).emit('newMessageAll', { message: message, pseudo: socket.pseudo });
        } else {
            // Message privé, sauvegarder dans la base de données, informer le destinataire et sauvegarder dans la base de données
            try {
                const utilisateur = await Utilisateurs.findOne({ pseudo: receveur }).exec();
                if (!utilisateur) {
                    return false;
                }

                // Trouver le socket du destinataire dans la liste des utilisateurs connectés
                socketreceiver = connectedUsers.find(socket => socket.pseudo === utilisateur.pseudo);

                if (socketreceiver) {
                    // Émettre l'événement 'whisper' au destinataire
                    socketreceiver.emit('whisper', { sender: socket.pseudo, message: message });
                }

                // Sauvegarder le message dans la base de données
                var msg = new mess();
                msg.content = message;
                msg.sender = socket.pseudo;
                msg.receveur = receveur;
                await msg.save();
            } catch (err) {
                console.error('Erreur lors de la recherche de l\'utilisateur destinataire :', err);
            }
        }
    });

    // Gestionnaire d'événement lorsqu'un utilisateur change de salon
    socket.on('changeChannel', (channel) => {
        _joinRoom(channel);
    });

    // Gestionnaire d'événement lorsqu'un utilisateur commence à écrire
    socket.on('writting', (pseudo) => {
        // Émettre un événement 'writting' aux autres utilisateurs du même salon
        socket.broadcast.to(socket.channel).emit('writting', pseudo);
    });

    // Gestionnaire d'événement lorsqu'un utilisateur arrête d'écrire
    socket.on('notwritting', (pseudo) => {
        // Émettre un événement 'notwritting' aux autres utilisateurs du même salon
        socket.broadcast.to(socket.channel).emit('notwritting');
    });

    // Gestionnaire d'événement lorsqu'un utilisateur se déconnecte
    socket.on('disconnect', () => {
        // Retirer le socket de l'utilisateur de la liste des utilisateurs connectés
        var index = connectedUsers.indexOf(socket);
        if (index > -1) {
            connectedUsers.splice(index, 1);
        }
        // Informer les autres utilisateurs de la déconnexion
        socket.broadcast.emit('quitUser', socket.pseudo);
    });

    // Fonction pour rejoindre un salon
    async function _joinRoom(channelParam) {
        var previousChannel = '';
        if(socket.channel){
            previousChannel=socket.channel;
        }

        // Quitter tous les salons et rejoindre le nouveau salon
        socket.leaveAll();
        socket.join(channelParam);
        socket.channel = channelParam;
    
        try {
            // Rechercher le salon dans la base de données
            const channel = await am.findOne({ name: socket.channel }).exec();
    
            if (channel) {
                // Salon existant, récupérer les anciens messages et émettre l'événement 'ancienmessages'
                const messages = await mess.find({ _id_room: socket.channel }).exec();
                if (!messages) {
                    return false;
                } else {
                    socket.emit('ancienmessages', messages, socket.pseudo);
                    // Émettre l'événement 'emitChannel' pour informer le changement de salon
                    if(previousChannel){
                        socket.emit('emitChannel', { previousChannel: previousChannel, newChannel: socket.channel})
                    }else{
                        socket.emit('emitChannel', { newChannel: socket.channel})
                    }
                }
            } else {
                // Nouveau salon, le créer dans la base de données, informer les autres utilisateurs et émettre l'événement 'emitChannel'
                const newChannel = new am({ name: socket.channel });
                await newChannel.save();
                socket.broadcast.emit('newChannel', socket.channel);
                socket.emit('emitChannel', { previousChannel: previousChannel, newChannel: socket.channel})

            }
        } catch (err) {
            console.error('Erreur lors de la recherche ou de la création du canal :', err);
        }
    }
});

// Démarrer le serveur sur le port 3005
server.listen(3005, () => console.log('Server started at port : 3005'));
