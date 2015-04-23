/**
 *  Kaban.tv plugin for Movian by Buksa
 *
 *  Copyright (C) 2013-2015 Buksa
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
// Version 1.5.1
//
(function(plugin) {
    var plugin_info = plugin.getDescriptor();
    var PREFIX = plugin_info.id;
    var logo = plugin.path + plugin_info.icon;
    
    var BASE_URL = "http://kaban.tv";
    var service = plugin.createService(plugin_info.title, PREFIX + ":start", "video", true, logo);
        //settings
    var settings = plugin.createSettings(plugin_info.title, logo, plugin_info.synopsis);
    settings.createInfo("info", logo, "Plugin developed by " + plugin_info.author + ". \n");
    settings.createDivider('Settings:');

    settings.createBool("debug", "Debug", false, function(v) {
        service.debug = v;
    });
    var jsonCurTime = JSON.parse(showtime.httpGet(BASE_URL + "/current-time"));
    this.date = jsonCurTime.currentTime.date;
    this.CDL = jsonCurTime.currentTime.millis;
    showtime.print(date + CDL)

    function startPage(page) {
        var channels = [];
        page.type = "directory";
        page.contents = "items";
        page.loading = false;
        channels = getChannels(BASE_URL);
        ch_list(page, channels);
        page.metadata.logo = plugin.path + "img/logo.png";
        page.metadata.title = "Kaban.tv : Список Каналов";
    }
    plugin.addURI(PREFIX + ":play:(.*)", function(page, url) {
        page.type = "video";
        page.loading = true;
        var stream = getStream(url);
        showtime.trace('Video Playback: Reading ' + stream);
        if (showtime.probe(stream).result === 0) {
            page.source = "videoparams:" + JSON.stringify({
                canonicalUrl: PREFIX + ":play:" + url,
                sources: [{
                        url: stream
                    }
                ]
            });
        } else page.error("Линк не проигрывается :(");
        page.loading = false;
    });
    plugin.addURI(PREFIX + ":channel:(.*):(.*):(.*)", function(page, link, date, title) {
        page.entries = 0;
        page.type = "directory";
        var url = (BASE_URL + '/tv/' + link.replace('tv5kanal', '5kanal') + '/' + date);
        var v = getDayDifference(date, -1).date;
        page.appendItem(PREFIX + ":channel:" + link + ':' + v + ':' + title, "video", {
            title: new showtime.RichText('Архив Канала за' + '<font color="6699CC"> [' + v + '] </font>'),
            icon: plugin.path + "img/" + link + ".png",
            description: new showtime.RichText('Канал Архив за <font color="6699CC">[' + v + '] </font>')
        });
        var json = JSON.parse(showtime.httpGet(url).toString());
        shTvPr(page, json, CDL);
        page.metadata.title = title + ": Программа Канала за " + json[0].tvChannelItemUI.dateName;
        page.loading = false;
    });

    function getChannels(url) {
        var html = showtime.httpGet(url).toString();
        var channels = [];
        var content = getValue(html, '<ul class="channels-block">', '</ul>');
        var split = content.split('<li>');
        for (var i = 1; i < split.length; i++) {
            var m = /<a class="(.+?)" href="(.+?)"><span>(.*)<\/span>/.exec(split[i]);
            if (m) var channel = {
                    url: m[1],
                    title: m[3],
                    icon: plugin.path + "img/" + m[1] + ".png"
            };
            channels.push(channel);
        }
        return channels;
    }

    function ch_list(page, channels) {
        for (var i in channels) {
            var channel = channels[i];
            if (channel.url) page.appendItem(PREFIX + ':channel:' + channel.url + ':' + date + ':' + channel.title, 'video', {
                    title: new showtime.RichText(channel.title),
                    icon: channel.icon
                });
        }
    }

    function getStream(url) {
        var match, tmp, v, stream
        var hash1 = "QHo10TdnvilZYfpMyN6DtLmcuj",
            hash2 = "3UIaVxs8z27WwGBXb94RkJe5g=";
        //rtmp: //213.186.127.42:1935/live/first.stream  swfUrl=http://kaban.tv/uppod.swf pageUrl=http://kaban.tv/pervii-kanal/player.jsx
        //rtmp://213.186.127.42:1935/live/rus1.stream swfUrl=http://kaban.tv/uppod.swf pageUrl=http://kaban.tv/rossiya-1-online

        v = showtime.httpReq(BASE_URL + url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36',
                'Host': 'kaban.tv',
                'Referer': BASE_URL + url.replace('/player.jsx', '-online').replace('.jsx', '').replace('/player/', '/')
            }
        }).toString();
        p(v)

        file = /file":"([^"]+)"/.exec(v)[1];
        print('file:' + file)
        file = unhash(file, hash1, hash2)
        print('file:' + file)
        //if (streams.indexOf('tmp:') !== -1) {
        //    match = /rtmp:(.+?).stream/g.exec(streams);
        //    while (match) {
        //        tmp = match[0];
        //        tmp += ' swfUrl=http://kaban.tv/uppod.swf';
        //        tmp += ' pageUrl=' + BASE_URL;
        //        tmp += ' tcUrl=' + match[0];
        //        tmp += ' flashVer=\'WIN 11,2,202,235\'';
        //        showtime.trace("trying open link :" + tmp);
        //        if (showtime.probe(tmp).result === 0) {
        //            stream = tmp;
        //            break;
        //        }
        //        match = /rtmp:(.+?).stream/g.exec(streams);
        //    }
        //}
        if (file.indexOf('.m3u8') !== -1) {
            var re = /http.+?m3u8/g;
            m = re.execAll(file);
            for (i = 0; i < m.length; i++) {
                stream = m[i].toString()
                showtime.notify("try open link: " + stream, 3);
                status = showtime.probe(stream)
                if (status.result === 0) {
                    return trim('hls:' + stream);
                }
                showtime.notify(status.errmsg, 3)

            }
        }
        return trim(file);
    }
    //function from dinamic source

    function getValue(doc, start, end) {
        var s = doc.indexOf(start);
        if (s < 0) return null;
        s = s + start.length;
        if (end !== null) {
            var e = doc.indexOf(end, s);
            if (e < 0) return null;
            return doc.substr(s, e - s);
        }
        return doc.substr(s);
    }

    function trim(s) {
        s = s.replace(/(\r\n|\n|\r)/gm, "");
        s = s.replace(/(^\s*)|(\s*$)/gi, "");
        s = s.replace(/[ ]{2,}/gi, " ");
        return s;
    }

    function getDayDifference(date, dayDifference) {
        var dateDifference = new Date();
        var partsDifference = date.split('-');
        dateDifference.setFullYear(partsDifference[0], partsDifference[1] - 1, partsDifference[2]); // year, month (0-based), day
        dateDifference.setTime(dateDifference.getTime() + dayDifference * 24 * 60 * 60 * 1000);
        var monthDifference = ((dateDifference.getMonth() + 1) < 10) ? ('0' + (dateDifference.getMonth() + 1)) : (dateDifference.getMonth() + 1);
        var dayMonthDifference = (dateDifference.getDate() < 10) ? ('0' + dateDifference.getDate()) : (dateDifference.getDate());
        var dateDifferenceString = (dateDifference.getYear() + 1900) + "-" + monthDifference + "-" + dayMonthDifference;
        return {
            date: dateDifferenceString,
            dayOfWeek: dateDifference.getDay()
        };
    }

    function shpr(page, json, index, CDL) {

        if (json[index].tvChannelItemUI.startTime < CDL && json[index].tvChannelItemUI.endTime <= CDL) {
            //http://kaban.tv/archive/pervii-kanal/2015-04-22/998838
            ////Kaban.tv:play:/archive/pervii-kanal/2013-03-07/605993
            //page.appendItem(PREFIX + ":play:" +"/archive/" + json[index].tvChannelItemUI.channelId + "/" + json[index].tvChannelItemUI.date + "/" + json[index].tvChannelItemUI.id, "video", {
            //Kaban.tv:play:/archive/player/pervii-kanal/605989.jsx

            page.appendItem(PREFIX + ":play:" + "/archive/player/" + json[index].tvChannelItemUI.channelId + "/" + json[index].tvChannelItemUI.id + ".jsx", "video", {
                // page.appendItem(PREFIX + ":play:" + "/archive/" + json[index].tvChannelItemUI.channelId + "/" + json[index].tvChannelItemUI.id, "video", {                
                title: new showtime.RichText('(' + json[index].tvChannelItemUI.startTimeMSK + ') ' + json[index].tvChannelItemUI.name),
                icon: plugin.path + "img/" + json[index].tvChannelItemUI.channelId + ".png",
                description: json[index].tvChannelItemUI.description
            });
        } else if (json[index].tvChannelItemUI.startTime <= CDL && json[index].tvChannelItemUI.endTime > CDL) {
            page.appendItem(PREFIX + ":play:" + "/" + json[index].tvChannelItemUI.channelId + "/player.jsx", "video", {
                title: new showtime.RichText('<font color="92CD00">Сейчас! (</font>' + json[index].tvChannelItemUI.startTimeMSK + ')' + json[index].tvChannelItemUI.name),
                icon: plugin.path + "img/" + json[index].tvChannelItemUI.channelId + ".png",
                description: json[index].tvChannelItemUI.description
            });
        } else {
            page.appendItem(PREFIX + ":play:" + "/" + json[index].tvChannelItemUI.channelId + "/player.jsx", "video", {
                title: new showtime.RichText('<font color="b3b3b3">(' + json[index].tvChannelItemUI.startTimeMSK + ') ' + json[index].tvChannelItemUI.name),
                icon: plugin.path + "img/" + json[index].tvChannelItemUI.channelId + ".png",
                description: json[index].tvChannelItemUI.description
            });
        }
    }

    function shTvPr(page, json, CDL) {
        for (var key = 0; key < json.length; key++) {
            page.entries++;
            shpr(page, json, key, CDL);
        }
    }

    function p(message) {
        if (typeof(message) === 'object') message = '### object ###' + '\n' + JSON.stringify(message) + '\n' + '### object ###';
        if (service.debug)
        showtime.print(message);
    }

    function base64_decode(data) { // http://kevin.vanzonneveld.net
        var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            dec = "",
            tmp_arr = [];
        if (!data) {
            return data;
        }
        data += '';
        do { // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));
            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;
            if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        } while (i < data.length);
        dec = tmp_arr.join('');
        return dec;
    }

    function unhash(hash, hash1, hash2) {
        hash = "" + hash;
        for (var i = 0; i < hash1.length; i++) {
            hash = hash.split(hash1[i]).join('--');
            hash = hash.split(hash2[i]).join(hash1[i]);
            hash = hash.split('--').join(hash2[i]);
        }
        //showtime.print(base64_decode(hash));
        return base64_decode(hash);
    }
 

    // Add to RegExp prototype
    RegExp.prototype.execAll = function(e) {
        for (var c = [], b = null; null !== (b = this.exec(e));) {
            var d = [],
                a;
            for (a in b) {
                parseInt(a, 10) == a && d.push(b[a]);
            }
            c.push(d);
        }
        return c;
    };
    plugin.addURI(PREFIX + ":start", startPage);
})(this);