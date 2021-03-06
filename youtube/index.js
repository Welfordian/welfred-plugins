module.exports = (require) => {
    const { ipcRenderer } = require('electron');
    const axios = require('axios');
    const settings = require('electron-settings');

    const YouTube = {
        term: '/yt',

        icon: 'youtube',

        settings: {
            "YouTube Authentication": {
                type: 'button',

                async buttonText() {
                    return await settings.get('plugins.youtube.logged_in') === undefined
                        ? "Login to YouTube"
                        : "Logout of YouTube";
                },

                async callback() {
                    ipcRenderer.on('youtube::login::did-navigate', (e, {url}) => {
                        if (url.indexOf('access_token') === -1) return;

                        let contents = JSON.parse('{"' + decodeURI(url.substring(url.indexOf('#')+1)).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');

                        if (contents.hasOwnProperty('state')) {
                            if (contents.state === 'youtube') {
                                (async () => {
                                    await settings.set('plugins.youtube.logged_in', contents.access_token);

                                    window.location.reload();

                                    ipcRenderer.send('youtube::login::close');
                                })();
                            }
                        }
                    });

                    if (await settings.get('plugins.youtube.logged_in') === undefined) {
                        const clientId = "<<CLIENT_ID>>";
                        const redirectUri = 'https://welfordian.github.io/youtube-embed-proxy/youtube-login';
                        const scope = 'https://www.googleapis.com/auth/youtube';

                        window.open(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=youtube`, 'youtube::login');
                    } else {
                        await settings.unset('plugins.youtube.logged_in');

                        window.location.reload();
                    }
                }
            }
        },

        commands: {
            play: {
                icon: 'play',

                description: "Play a YouTube video",

                async handle(term) {
                    let videoId;

                    if (/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch(?:\.php)?\?.*v=)([a-zA-Z0-9\-_]+)/.test(term)) {
                        videoId = /(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>]+)/.exec(term)[5];
                    } else {
                        const url = "https://www.googleapis.com/youtube/v3/search?maxResults=1&key=<<API_KEY>>&maxResults=1&q=" + term + "&type=video&part=snippet";

                        videoId = await (await axios.get(url)).data.items[0].id.videoId;
                    }

                    ipcRenderer.send('open-window', {
                        name: 'youtube-player',
                        url: 'https://welfordian.github.io/youtube-embed-proxy/#' + videoId,
                        width: 470,
                        height: 275,
                        position: 'bottomRight',
                        alwaysOnTop: true,
                    });

                    ipcRenderer.send('set-touchBar', {
                        name: 'youtube-player',
                        items: [
                            {
                                type: 'button',
                                label: 'Play',
                                callback: 'youtube::playPause'
                            }
                        ]
                    });
                }
            },

            search: {
                icon: 'search',

                description: "Search YouTube for...",

                handle(term) {
                    require('electron').shell.openExternal('https://www.youtube.com/results?search_query=' + term);
                }
            },

            sleep: {
                icon: 'alarm-clock',
                description: "A dummy command for testing..."
            }
        }
    }

    return YouTube;
}