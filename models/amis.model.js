const mongoose = require('mongoose');
 var amisSchema = new mongoose.Schema({
   name : String
 });

 mongoose.model('amis', amisSchema);