const mongoose = require('mongoose');
 var messageSchema = new mongoose.Schema({
   _id_room :{
        type: String
   },
   sender: String,
   receveur: String,
   content: String
 });

 mongoose.model('message', messageSchema);