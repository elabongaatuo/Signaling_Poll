// Channel Initialization Variables
let appID = "fc36626cc93b4ff1a0d4591932f92e93";
let uid = String(Math.floor(Math.random() * 232));
let token = null;
let channelName = 'main';
let client;
let channel;

//Event Flow Variables
let channelEvents = {};
let clientEvents = {};

// Capture querying peer and voting peer(s) Unique ID
let localUID = 'null';
let voterUID = 'null';

// Votes details
let collectedVotes = [];
let votes = {};
let clickedButtonText = 'null';

// Handle Poll Creation Data
let pollData = {
    question: '',
    options: []
};



// Create and Initialize Channel
let initiateRTM = async () => {
    client = await AgoraRTM.createInstance(appID);
    await client.login({ uid, token });

    channel = await client.createChannel(channelName);
    await channel.join();

    // Create Poll Variables and Event Listeners
    const createPollButton = document.getElementById('createPollButton');
    const createPoll = document.getElementById('createPoll');
    const popupContainer = document.getElementById('popupContainer');

    createPollButton.addEventListener('click', function () {
        createPoll.classList.add('show');
    });

    window.addEventListener('click', function (event) {
        if (event.target === createPoll) {
            createPoll.classList.remove('show');
        }
    });

    // Channel Events
    channelEvents.ChannelMessage = (message, peerId) => {
        // obtain UID of the queerying peer
        localUID = peerId;
        //render poll to peers in channel
        renderPoll(message);



    };

    //Client Events
    clientEvents.MessageFromPeer = (message, peerId) => {
        // obtain UID of voting peer
        voterUID = peerId;
        if (message.messageType === 'TEXT') {
            const sentence = processVoteMessage(message);
            document.getElementById("voteSentence").appendChild(document.createElement('div')).innerHTML = sentence;
        };
    };

    channel.on('ChannelMessage', channelEvents.ChannelMessage);

    client.on('MessageFromPeer', clientEvents.MessageFromPeer);
};


initiateRTM();


// Add Options During Poll Creation
function addOptions() {
    const optionsContainer = document.getElementById('optionsContainer');

    if (pollData.options.length >= 4) {
        const addOptionButton = document.getElementById('addOptionButton');
        addOptionButton.style.display = 'none';
        return;
    }

    const optionInput = document.createElement('input');
    const optionId = `option${pollData.options.length}`;
    const placeholderText = `Choice ${pollData.options.length + 1}`;

    optionInput.type = 'text';
    optionInput.placeholder = placeholderText;
    optionInput.className = 'answerOption';
    optionInput.id = optionId;

    optionsContainer.appendChild(optionInput);
    optionsContainer.appendChild(document.createElement('br'));

    pollData.options.push({
        id: optionId,
        text: ''
    });
}

// Close create poll popup
function closePopup() {
    const createPoll = document.getElementById('createPoll');
    createPoll.classList.remove('show');
}

// Close poll after vote submission
function closePoll() {
    const popupContainer = document.getElementById('popupContainer');
    popupContainer.style.display = 'none';
}

// Submit poll to channel
function submitPoll() {
    const questionInput = document.getElementById('questionInput');
    pollData.question = questionInput.value;

    const optionInputs = document.getElementsByClassName('answerOption');
    for (let i = 0; i < optionInputs.length; i++) {
        const optionId = `option${i}`;
        const optionText = optionInputs[i].value || 'Enter option';

        const option = pollData.options.find(o => o.id === optionId);
        if (option) {
            option.text = optionText;
        }
    }

    const messageContent = {
        question: pollData.question,
        options: pollData.options.map(option => option.text)
    };

    const textMessage = {
        text: JSON.stringify(messageContent)
    };

    // Send poll to channel
    async function sendToChannel() {

        try {
            await channel.sendMessage(textMessage);
        } catch (error) {
            console.error('Failed to send poll data:', error);
        }

        channel.on('ChannelMessage', (message, peerId) => {
            renderPoll(message);
        });
    }

    sendToChannel();
    closePopup();

    // Send Results to Querying Peer
    setTimeout(() => {
        sendVoteToQueryingPeer();
    }, 10000);


}





// Process message received by queerying peer after vote submission
function processVoteMessage(message) {
    try {
        const data = JSON.parse(message.text);
        const memberId = data.collectedVotes[0].memberId;
        const vote = data.buttonTextContent;
        return `${memberId} has voted "${vote}"`;
    } catch (error) {
        console.error('Error processing vote message:', error);
        return null;
    }
}

// Render created poll to channel
function renderPoll(textMessage) {
    const messageContent = JSON.parse(textMessage.text);

    const pollContent = document.getElementById('pollContent');
    pollContent.innerHTML = `<h3>${messageContent.question}</h3>`;



    messageContent.options.forEach((optionText, index) => {
        const dummyOption = { id: `option${index}`, text: optionText }
        const voteButton = createVoteButton(dummyOption);
        pollContent.appendChild(voteButton);



    });


    const popupContainer = document.getElementById('popupContainer');
    popupContainer.style.display = 'block';
}


// Create option buttons
function createVoteButton(option) {
    const voteButton = document.createElement('button');
    voteButton.classList.add('optionButton');
    voteButton.setAttribute('id', `tallyDisplay_${option.id}`);
    voteButton.textContent = option.text;
    voteButton.addEventListener('click', handleVoteButtonClick);
    return voteButton;
}


// Handle selected button details
async function handleVoteButtonClick(event) {
    var optionButtons = document.getElementsByClassName("optionButton");
    let element = event.target;
    clickedButtonText = element.childNodes[0].nodeValue.trim();
    element.style.backgroundColor = '#ccc';
    element.style.cursor = 'default';
    for (var i = 0; i < optionButtons.length; i++) {
        optionButtons[i].disabled = true;
    }

    // Update vote for current member
    votes[uid] = clickedButtonText;

    displayMemberVote(uid, clickedButtonText);

    // Collect vote in list 
    collectedVotes.push({
        memberId: uid,
        vote: clickedButtonText
    });

    // Call sendVoteToQueryingPeer here with clickedButtonText
    await sendVoteToQueryingPeer(clickedButtonText);

    return clickedButtonText;
}

// Display member vote log
function displayMemberVote(memberId, vote) {
    const logElement = document.getElementById("log");
    const message = `${memberId} voted for "${vote}"`;
    logElement.appendChild(document.createElement('div')).append(message);
}

// Send Vote Feedback to Querying Peer
async function sendVoteToQueryingPeer() {

    const messageContent = {
        updateResults: true,
        buttonTextContent: clickedButtonText,
        options: pollData.options.map(option => option.text),
        message: 'A vote was submitted!',
        collectedVotes: collectedVotes
    };

    const textMessage = {
        text: JSON.stringify(messageContent)
    };


    await client.sendMessageToPeer(textMessage, localUID).then(sendResult => {
        if (sendResult.hasPeerReceived && uid !== localUID) {
            console.log("sent message", textMessage)
        } else {
            console.log("no user")
        }
    }).catch(error => { console.log("Votes forwarded to peer:", textMessage) })


}

