const express = require('express');
const database = require('../src/database');
const Request = require('request');
const router = express.Router();
const util = require('util');

// Drei Routen für typische CRUD-Operationen
router.get('/:id', getItem);
router.put('/:id', putItem);
router.delete('/:id', delItem);

const collection = database.getCollection('store');

function getItem(req, res) {
    // wir liefern immer von der lokalen DB aus
    let items = collection.find({key: req.params.id});
    if (items.length == 0) {
        res.status(404).end();
    } else {
        res.json(items[0].value);
    }
}

function putItem(req, res) {
    let items = collection.find({key: req.params.id});
    let item;
    if (items.length == 0) {
        item = collection.insert({key: req.params.id, value: req.body});
    } else {
        item = items[0];
        item.value = req.body;
        collection.update(item);
    }
    // wir antworten schon, *bevor* wir Antwort von den Replikas haben.
    // Implikation?
    res.json(item.value);
    replicate(req);
}

function delItem(req, res) {
    let items = collection.find({key: req.params.id});
    if (items.length == 0) {
        res.status(404).end();
    } else {
        let item = items[0];
        collection.remove(item);
        res.json(item.value);
    }
    replicate(req)
}


function replicate(req) {
    // falls die URL schon ?source angegeben hat, ist diese Instanz *Ziel* einer Replikation
    // --> nicht nochmal weiter replizieren
    if (req.query.source > 0) {
        return;
    }

    // sonst alle Server durchgehen
    for (let i = 1; i <= global.server_count; i++) {
        if (i == global.server_id) {
            // mit Ausnahme des eigenen
            continue;
        }

        // und selben Request dorthin senden
        let port = 3000 + i - 1;
        let url = util.format('http://127.0.0.1:%d/store/%s?source=%d', port, req.params.id, global.server_id);
        Request({method: req.method, url: url, json: req.body, timeout: 500}, logResponse);

        function logResponse(err, resp, body) {
            // wir werten nichts aus, sondern in einem Fehlerfall geben wir nur eine Log-Meldung aus.
            // was bedeutet das für die Datensicherheit im Cluster?
            if (err) {
                console.log(err.message);
            }
        }
    }
}


module.exports = router;
