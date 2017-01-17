var registerPromiseWorker = require('promise-worker-transferable/register');

registerPromiseWorker(function (message, withTransferList) {
    if (typeof api[message.method] !== 'function') {
        throw new Error('Invalid method ' + message.method);
    }

    var data = api[message.method](message.data);
    return withTransferList(data, [data.buffer]);
});

var api = {
    multiply: function (data) {
        return data.array
            .map((cell) => {
                return cell * data.multiplier;
            })
            .reverse()
            .sort();
    }
};
