const Loki = require("lokijs");

const db = new Loki('replication.json');

const store = db.addCollection('store');
store.insert({key: 'key1', value: 'value one'});
store.insert({key: 'key2', value: 'value two'});
store.insert({key: 'key3', value: 'value three'});

module.exports = db;