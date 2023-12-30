var socket = io.connect('http://localhost:3005');
var pseudo;

// Utilisation d'une fonction asynchrone pour demander le pseudo
async function askForPseudo() {
  while (!pseudo) {
    pseudo = await promptAsync('Quel est ton nom ? ');
  }

  // Émettre l'événement 'newUser' avec le pseudo
  socket.emit('newUser', pseudo);

  // Mettre à jour le titre de la page avec le pseudo
  document.title = pseudo + '  - ' + document.title;
}

// Fonction pour simuler la fonction prompt de manière asynchrone
function promptAsync(question) {
  return new Promise((resolve) => {
    const userResponse = prompt(question);
    resolve(userResponse);
  });
}

// Appel de la fonction asynchrone pour demander le pseudo
askForPseudo().then(() => {
  // Émettre l'événement 'pseudo' avec le pseudo au serveur
  socket.emit('pseudo', pseudo);
  // Émettre l'événement 'ancienwhispers' pour récupérer les anciens messages privés
  socket.emit('ancienwhispers', pseudo);
  // Mettre à jour le titre de la page avec le pseudo
  document.title = pseudo + '  - ' + document.title;
});

// Écouter l'événement de soumission du formulaire de message
document.getElementById('msg').addEventListener('submit', (e) => {
  e.preventDefault();
  const textInput = document.getElementById('msgInput').value;
  document.getElementById('msgInput').value = '';

  const receveur = document.getElementById('receveurinput').value;

  if (textInput.length > 0) {
    // Émettre un nouveau message au serveur
    socket.emit('newMessage', textInput, receveur);
    // Créer et afficher le message localement si le destinataire est 'all'
    if (receveur === "all") {
      createElementFunction('newMess', textInput);
    }
  } else {
    return false;
  }
});


// Écouter l'événement 'welcome' pour afficher le message de bienvenue
socket.on('welcome', (pseudo) => {
  const welcomeMessage = document.createElement('div');
  welcomeMessage.id = 'welcomeMessage';
  welcomeMessage.textContent = 'Bienvenue dans le chat de ' + pseudo;
  document.getElementById('dev').appendChild(welcomeMessage);
});
// Écouter l'événement 'newUser' pour afficher les nouveaux utilisateurs
socket.on('newUser', (pseudo) => {
  createElementFunction('newUser', pseudo);
});

// Écouter l'événement 'ancienwhispers' pour afficher les anciens messages privés
socket.on('ancienwhispers', (messages) => {
  messages.forEach(message => {
    createElementFunction('ancienwhispers', message)
  });
});

// Écouter l'événement 'newMessageAll' pour afficher les nouveaux messages publics
socket.on('newMessageAll', (content) => {
  createElementFunction('newMessageAll', content, 'publicMessages');
});

// Écouter l'événement 'whisper' pour afficher les nouveaux messages privés
socket.on('whisper', (content) => {
  createElementFunction('whisper', content, 'privateMessages');
});

// Écouter l'événement 'newChannel' pour créer un nouveau salon
socket.on('newChannel', (newChannel) => {
  createChannel(newChannel);
});

// Écouter l'événement 'emitChannel' pour mettre à jour l'affichage des salons
socket.on('emitChannel', (channels) => {
  if (channels.previousChannel) {
    document.getElementById(channels.previousChannel).classList.remove('inChannel');
  }
  document.getElementById(channels.newChannel).classList.add('inChannel');
});

// Écouter l'événement 'ancienmessages' pour afficher les anciens messages publics
socket.on('ancienmessages', (messages) => {
  messages.forEach(message => {
    if (message.sender === pseudo) {
      createElementFunction('ancienmessagesmoi', message, 'privateMessages');
    } else {
      createElementFunction('ancienmessages', message, 'publicMessages');
    }
  });
});

// Écouter l'événement 'writting' pour indiquer qu'un utilisateur est en train d'écrire
socket.on('writting', (pseudo) => {
  document.getElementById('ecrire').textContent = pseudo + ' est en train d\'écrire';
});

// Écouter l'événement 'notwritting' pour indiquer qu'un utilisateur a arrêté d'écrire
socket.on('notwritting', () => {
  document.getElementById('ecrire').textContent = '';
});

// Écouter l'événement 'quitUser' pour afficher qu'un utilisateur a quitté le chat
socket.on('quitUser', (pseudo) => {
  createElementFunction('quitUser', pseudo);
});

// Fonction pour émettre l'événement 'writting' lorsque l'utilisateur écrit
function writting() {
  socket.emit('writting', pseudo);
};

// Fonction pour émettre l'événement 'notwritting' lorsque l'utilisateur arrête d'écrire
function notwritting() {
  socket.emit('notwritting');
};

// Fonction pour créer un nouveau salon dans la liste
function createChannel(newChannel) {
  const newRoomItem = document.createElement('li');
  newRoomItem.classList.add('elementList')
  newRoomItem.id = newChannel;
  newRoomItem.textContent = newChannel;
  newRoomItem.setAttribute('onclick', "_joinRoom('" + newChannel + "')");
  document.getElementById('roomList').insertBefore(newRoomItem, document.getElementById('createNewRoom'));
}

// Fonction pour rejoindre un salon
function _joinRoom(channel) {
  // Retirez la classe "active" de tous les éléments
  const roomListItems = document.querySelectorAll('#roomList li');
  roomListItems.forEach(item => item.classList.remove('active'));

  // Ajoutez la classe "active" à l'élément de la room actuelle
  const currentRoomItem = document.getElementById(channel);
  if (currentRoomItem) {
    currentRoomItem.classList.add('active');
  }

  document.getElementById('messagecont').innerHTML = "";
  socket.emit('changeChannel', channel);
}

// Fonction pour créer un nouveau salon
function _createRoom() {
  while (!newRoom) {
    var newRoom = prompt('Quel est le nom de la nouvelle room ? ');
  }

  createChannel(newRoom);
}

// Fonction pour créer dynamiquement des éléments HTML en fonction du type de message
function createElementFunction(element, content) {
  const newElement = document.createElement('div');
  switch (element) {
    case 'newUser':
      newElement.classList.add(element, 'message');
      newElement.textContent = content + ' a rejoint le tchat';
      showAlert(newElement.classList.toString(), newElement.textContent);
      break;

    case 'newMess':
      newElement.classList.add(element, 'message');
      newElement.innerHTML = pseudo + ': ' + content;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    case 'newMessageAll':
      newElement.classList.add(element, 'message');
      newElement.innerHTML = content.pseudo + ': ' + content.message;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    case 'whisper':
      newElement.classList.add(element, 'message');
      newElement.innerHTML = content.sender + ' vous a envoyé: ' + content.message;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    case 'ancienmessages':
      newElement.classList.add(element, 'message');
      newElement.innerHTML = content.sender + ': ' + content.content;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    case 'ancienwhispers':
      newElement.classList.add(element, 'message');
      newElement.innerHTML = content.sender + ' vous dit :  ' + content.content;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    case 'ancienmessagesmoi':
      newElement.classList.add('newMess', 'message');
      newElement.innerHTML = content.sender + ': ' + content.content;
      document.getElementById('messagecont').appendChild(newElement);
      break;

    // Fonction pour afficher une alerte avec la classe et le contenu du message
    function showAlert(className, message) {
      alert(message);
    }

    // Modifier le cas 'quitUser' dans la fonction createElementFunction
    case 'quitUser':
      newElement.classList.add(element, 'message');
      newElement.textContent = content + ' a quitté le tchat';

      // Afficher une alerte avec la classe et le contenu du message
      showAlert(newElement.classList.toString(), newElement.textContent);
      break;
  }
}
