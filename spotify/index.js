module.exports = (require) => {
    const applescript = require('applescript');
    const { ipcRenderer } = require('electron');
    const axios = require('axios');
    const moment = require('moment');
    const settings = require('electron-settings');

    let clientId;
    let pluginTerm = '/s';
    let clientSecret;

    const Spotify = {
        term: pluginTerm,
        description: 'Control Spotify from Welfred',

        settings: {
            invokeTerm: {
                type: 'string',
                default: '/s'
            },
            clientId: {
                type: 'string'
            },
            clientSecret: {
                type: 'string'
            },
            login: {
                type: 'button',

                async buttonText() {
                    return await settings.get('plugins.spotify.logged_in')
                        ? "Logout"
                        : "Login";
                },

                callback() {
                    alert('This button does nothing! Perhaps authenticate with Spotify to control the player itself and remove AppleScript?');
                }
            }
        },

        async boot() {
            clientId = await settings.get('plugins.spotify.clientId');
            clientSecret = await settings.get('plugins.spotify.clientSecret');
            pluginTerm = await settings.get('plugins.spotify.invokeTerm');

            if (pluginTerm === undefined) {
                pluginTerm = '/s';
            }

            Spotify.term = pluginTerm;
        },

        internal: {
            async client() {
                await Spotify.internal.verifyAccessToken();

                return axios.create({
                    baseURL: 'https://api.spotify.com/v1/',
                    headers: {
                        Authorization: 'Bearer ' + Spotify.internal.accessToken.access_token
                    }
                })
            },

            accessToken: null,

            accessTokenExpired() {
                return moment().isAfter(Spotify.internal.accessToken.expiresAt);
            },

            verifyAccessToken() {
                return new Promise((resolve, reject) => {
                    if (Spotify.internal.accessToken === null || Spotify.internal.accessTokenExpired()) {
                        axios({
                            method: "post",
                            url: 'https://accounts.spotify.com/api/token',
                            data: "grant_type=client_credentials",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/x-www-form-urlencoded",
                            },
                            auth: {
                                username: clientId, // User ID
                                password: clientSecret,  // User Secret
                            },
                        }).then(({data}) => {
                            Spotify.internal.accessToken = data;

                            Spotify.internal.accessToken.expiresAt = moment().add(Spotify.internal.accessToken.expires_in, 'seconds');

                            resolve();
                        }).catch((err) => {
                            reject();
                        });
                    } else {
                        resolve();
                    }
                });
            }
        },

        commands: {
            play: {
                description: 'Resume Spotify playback or queue a song',

                handle(track = false) {
                    if (! track) {
                        const script = `tell application "Spotify" to play`;

                        applescript.execString(script, (err, rtn) => {
                            if (err) {
                                ipcRenderer.send('log', err);
                            }

                            if (Array.isArray(rtn)) {
                                for (const songName of rtn) {
                                    ipcRenderer.send('log', songName);
                                }
                            } else {
                                ipcRenderer.send('log', rtn);
                            }
                        });
                    } else {
                        Spotify.commands.track.handle(track);
                    }
                }
            },

            pause: {
                description: 'Pause Spotify playback',
                async handle() {
                    const script = `tell application "Spotify" to pause`;

                    applescript.execString(script, (err, rtn) => {
                        if (err) {
                            ipcRenderer.send('log', err);
                        }

                        if (Array.isArray(rtn)) {
                            for (const songName of rtn) {
                                ipcRenderer.send('log', songName);
                            }
                        } else {
                            ipcRenderer.send('log', rtn);
                        }
                    });
                }
            },

            track: {
                async handle(track) {
                    let client = await Spotify.internal.client();

                    client.get('search', {
                        params: {
                            q: track,
                            type: 'track'
                        }
                    }).then(({data}) => {
                        const script =
                            `tell application "Spotify"
                            play track "${data.tracks.items[0].uri}"
                        end tell`;

                        applescript.execString(script, (err, rtn) => {
                            if (err) {
                                ipcRenderer.send('log', err);
                            }

                            if (Array.isArray(rtn)) {
                                for (const songName of rtn) {
                                    ipcRenderer.send('log', songName);
                                }
                            } else {
                                ipcRenderer.send('log', rtn);
                            }
                        });
                    });
                }
            }
        }
    };

    return Spotify;
}