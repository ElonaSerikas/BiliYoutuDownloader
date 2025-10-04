import React from 'react';
import { Body1, Link, Card, Subtitle2 } from '@fluentui/react-components';

export default function AboutPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <Card style={{ textAlign: 'center', padding: '24px' }}>
                <Subtitle2>BiliYoutuDownloader</Subtitle2>
                <Body1>版本 1.0.0</Body1>
                <Body1 style={{ marginTop: '16px' }}>
                    © 2025 LancyCelestia. 版权所有
                </Body1>
                 <Body1 style={{ marginTop: '8px' }}>
                    本软件基于 <Link href="https://www.electronjs.org/" target="_blank">Electron</Link> 和 <Link href="https://react.dev/" target="_blank">React</Link> 构建。
                </Body1>
            </Card>

            <Card style={{ padding: '24px' }}>
                <Subtitle2>法律与合规声明</Subtitle2>
                <Body1 style={{ marginTop: '12px' }}>
                    本软件仅供个人学习、研究等非商业用途。请在使用过程中严格遵守 Bilibili、YouTube 的用户协议以及您所在地的相关法律法规。
                </Body1>
                <Body1 style={{ marginTop: '12px' }}>
                    任何因使用本软件下载受版权保护内容而导致的法律问题，由使用者自行承担，开发者概不负责。
                </Body1>
            </Card>

        </div>
    );
}