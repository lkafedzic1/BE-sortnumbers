const express = require('express');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());

function mergeSortNumbers (numbers) {
    if (numbers.length < 2) return numbers;
    const mid = Math.floor(numbers.length / 2);
    const left = mergeSortNumbers(numbers.slice(0, mid));
    const right = mergeSortNumbers(numbers.slice(mid));
    return merge(left, right);
}

function merge (left, right) {
    let result = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
        if (left[i] < right[j]) {
            result.push(left[i++]);
        } else {
            result.push(right[j++]);
        }
    }
    return result.concat(left.slice(i), right.slice(j));
}

app.post('/SortNumbers', [
    body('numbers')
        .isArray({ min: 1 })
        .withMessage('The numbers field must be a non-empty array.')
        .custom((value) => value.every((num) => typeof num === 'number'))
        .withMessage('All elements in the numbers array must be numbers.'),
    body('filterType')
        .optional()
        .isIn(['<', '>', '='])
        .withMessage('The filterType must be one of the following: <, >, =.'),
    body('filterValue')
        .optional()
        .isNumeric()
        .withMessage('The filterValue must be a number.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { numbers, filterType, filterValue } = req.body;

    if (filterType && filterValue == null) {
        return res.status(400).json({ error: 'If filterType is provided, filterValue must also be provided.' });
    }

    const stmt = db.prepare("INSERT INTO numbers (number, datetime) VALUES (?, ?)");
    const currentDatetime = new Date().toISOString();
    stmt.run(JSON.stringify(numbers), currentDatetime);
    stmt.finalize();

    db.all("SELECT * FROM numbers", [], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach((row) => {
            const numbers = JSON.parse(row.number);
            console.log(`ID: ${ row.id }, Numbers: ${ numbers }, Datetime: ${ row.datetime }`);
        });

    });

    let filteredNumbers = numbers;
    if (filterType) {
        switch (filterType) {
            case '<':
                filteredNumbers = numbers.filter((num) => num < filterValue);
                break;
            case '>':
                filteredNumbers = numbers.filter((num) => num > filterValue);
                break;
            case '=':
                filteredNumbers = numbers.filter((num) => num === filterValue);
                break;
            default:
                return res.status(400).json({ error: 'Invalid filterType.' });
        }
    }

    const sortedNumbers = mergeSortNumbers(filteredNumbers);

    res.status(200).json({ sortedNumbers });
});

app.get('/MostFrequentNumbers', (req, res) => {
    const count = parseInt(req.query.count, 10);

    const fiveMinutesAgo = moment().subtract(5, 'minutes').format('YYYY-MM-DD HH:mm:ss');

    db.all(`
      SELECT number, datetime
      FROM numbers
      WHERE datetime > ?
    `, [fiveMinutesAgo], (err, rows) => {

        const frequencyMap = {};
        rows.forEach(row => {
            const numbersArray = JSON.parse(row.number);

            numbersArray.forEach(number => {
                if (frequencyMap[number]) {
                    frequencyMap[number]++;
                } else {
                    frequencyMap[number] = 1;
                }
            });

        });

        const sortedNumbers = Object.entries(frequencyMap)
            .map(([number, frequency]) => ({ number, frequency }))
            .sort((a, b) => b.frequency - a.frequency);

        const result = sortedNumbers.slice(0, count);

        res.status(200).json(result);
    });
});

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`
    CREATE TABLE numbers (
      id INTEGER PRIMARY KEY, 
      number TEXT,
      datetime TEXT
    )
  `);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${ PORT }`);
});

module.exports = app;
