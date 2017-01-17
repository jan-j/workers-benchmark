const PromiseWorker = require('promise-worker-transferable');

const worker = new PromiseWorker(new Worker('/worker-bundle.js'));

const workers = Array.apply(null, new Array(8)).map(() => {
    return new PromiseWorker(new Worker('/worker-bundle.js'));
});

var logDuration = window.logDuration = function (title, callback, iterations, offset) {
    iterations = iterations || 1;
    offset = offset || 0;

    console.log(`Starting timer: ${title}`);

    let total = 0;
    let lastPromise = Promise.resolve();
    for (let i = 0; i < iterations + offset; i++) {
        lastPromise = lastPromise.then(() => {
            const start = Date.now();
            return Promise.resolve(callback(i))
                .then(() => {
                    return start;
                });
        }).then((start) => {
            const duration = Date.now() - start;

            if (i >= offset) {
                total += duration;
            }

            console.log(`Iteration #${i - offset}: ${duration}ms`);
        });
    }

    return lastPromise.then(() => {
        console.log(`Average iteration: ${(total / iterations).toFixed(2)}ms`);
        console.log(`Total: ${total}ms`);
    });
};

var multiply = function (data) {
    return data.array
        .map((cell) => {
            return cell * data.multiplier;
        })
        .reverse()
        .sort();
};

var split = function (array, chunksNumber) {
    const chunks = [];
    const chunkSizeBase = Math.floor(array.length / chunksNumber) * Int32Array.BYTES_PER_ELEMENT;
    const chunkExtra = array.length % chunksNumber;
    let position = 0, chunkSize;
    for (let i = 0; i < chunksNumber; i++) {
        chunkSize = chunkSizeBase + (i < chunkExtra ? Int32Array.BYTES_PER_ELEMENT : 0);
        chunks.push(new Int32Array(array.buffer.slice(position, position + chunkSize)));
        position += chunkSize;
    }

    return chunks;
};

var join = function (arrays, totalLength) {
    const array = new Int32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < arrays.length; i++) {
        array.set(arrays[i], offset);
        offset += arrays[i].length;
    }

    return array;
};

var n = 1000 * 1000;
var array = (new Int32Array(n)).map((undefined, i) => i);

var iterations = 10;
var offset = 3;

var data = [];
for (var i = 0; i < 3; i++) {
    data[i] = [];
    for (var j = 0; j < iterations + offset; j++) {
        data[i][j] = {
            array: new Int32Array(array),
            multiplier: 2,
        };
    }
}

let d1 = [], d2 = [];
Promise.resolve()
    .then(() => {
        return logDuration('Main', (i) => {
            d1 = multiply(data[0][i]);
        }, iterations, offset);
    })
    .then(() => {
        return logDuration('Worker', (i) => {
            return worker.postMessage({
                method: 'multiply',
                data: data[1][i]
            }, [data[1][i].array.buffer])
                .then((data) => {
                    d2 = data;
                });
        }, iterations, offset);
    })
    .then(() => {
        return logDuration('Workers', (i) => {
            return Promise.all(
                split(data[2][i].array, workers.length).map((array, chunkIndex) => {
                    return workers[chunkIndex].postMessage({
                        method: 'multiply',
                        data: {
                            array: array,
                            multiplier: 2,
                        }
                    }, [array.buffer]);
                })
            )
                .then((arrays) => {
                    d2 = join(arrays, data[2][i].array.length);
                });
        }, iterations, offset);
    })
    .then(() => {
        console.log('Start comparison: ', JSON.stringify(d1.slice(0, 100)) === JSON.stringify(d2.slice(0, 100)));
        console.log('End comparison: ', JSON.stringify(d1.slice(-100)) === JSON.stringify(d2.slice(-100)));
        console.log('d1', d1.slice(0, 10));
        console.log('d2', d2.slice(0, 10));
    })
;

