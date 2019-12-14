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
    let items = collection.findOne({key: req.params.id});
    if (items === null) {
        res.status(404).end();
    } else {
        res.json(items.value);
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
    replicate(req, res, item.value);
}

function delItem(req, res) {
    let items = collection.find({key: req.params.id});
    if (items.length == 0) {
        res.status(404).end();
    } else {
        let item = items[0];
        collection.remove(item);
        replicate(req, res, item.value)
    }
}


function replicate(req, response, value) {
    // falls die URL schon ?source angegeben hat, ist diese Instanz *Ziel* einer Replikation
    // --> nicht nochmal weiter replizieren
    if (req.query.source > 0) {
        response.json(value);
        return;
    }
    let response_count = 0;
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
            response_count++;
            console.log('responseNo.: ' + response_count + ' received');
            if(response_count === global.server_count -1) {
                // alle Antworten erhalten
                response.json(value);
            }
            // wir werten nichts aus, sondern in einem Fehlerfall geben wir nur eine Log-Meldung aus.
            // was bedeutet das für die Datensicherheit im Cluster?
            if (err) {
                console.log(err.message);
            }
        }
    }
}


module.exports = router;
