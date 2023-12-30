const mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    pseudo : String
});

// Enregistrez le modèle avec le nom "utilisateur" (singulier)
mongoose.model('utilisateurs', userSchema);
