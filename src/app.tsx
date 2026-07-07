import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Grid, GridItem, Nav, NavItem, NavList, Page, PageSidebar } from '@patternfly/react-core';

import cockpit from 'cockpit';
import { Editor } from './components/code-editor';
import { Playbook } from './components/types';

const _ = cockpit.gettext;

export const Application = () => {
    const [ansiblePlaybooks, setAnsiblePlaybooks] = useState<Playbook[]>([]);
    const [currentPlaybook, setCurrentPlaybook] = useState<Playbook | null>(null);

    const getPlaybooks = useCallback(() => {
        const promises: Promise<Playbook[]>[] = [];
        ["/usr/share/ansible/playbooks", "/var/lib/ansible/playbooks"].forEach(element => {
            const promise = cockpit.spawn(["find", element, "-type", "f", "-name", "*.yaml"])
                    .then((output): Promise<Playbook>[] => {
                        return output.split("\n").filter((v) => v !== "")
                                .map(async (playbook_path): Promise<Playbook> => {
                                    const content = await cockpit.file(playbook_path).read();
                                    return {
                                        path: playbook_path,
                                        script_name: playbook_path.split("/").reverse()[0],
                                        content,
                                        parent_playbook: null,
                                        output: "",
                                    };
                                });
                    })
                    .then(async (plays) => {
                        return Promise.all(plays).then((playbooks) => {
                            return playbooks.sort((a, b) => new Intl.Collator().compare(a.path, b.path));
                        });
                    });
            promises.push(promise);
        });

        Promise.all(promises)
                .then((playbooks) => {
                    let parented_playbooks: Playbook[] = [];
                    if (playbooks[1].length === 0) {
                        parented_playbooks = playbooks[0];
                    } else {
                        playbooks[0].forEach((playbook) => {
                            let found_playbook = false;
                            playbooks[1].forEach((modified_playbook) => {
                                console.log("playbook:", playbook, modified_playbook);
                                if (playbook.script_name === modified_playbook.script_name) {
                                    found_playbook = true;
                                    modified_playbook.parent_playbook = playbook;
                                    parented_playbooks.push(modified_playbook);
                                }
                            });
                            if (!found_playbook) {
                                parented_playbooks.push(playbook);
                            }
                        });
                    }
                    if (!currentPlaybook) {
                        setCurrentPlaybook(parented_playbooks[0] || null);
                    }
                    setAnsiblePlaybooks(parented_playbooks);
                });
    }, [currentPlaybook]);

    useEffect(() => {
        getPlaybooks();
    }, [getPlaybooks]);

    return (
        <Page sidebar={<PageSidebar isSidebarOpen={false} />}>
            <Card>
                <CardTitle>{_("Ansible Playbooks")}</CardTitle>
                <CardBody>
                    <Grid>
                        <GridItem span={2}>
                            <Nav
                                onSelect={
                                    (_event: React.FormEvent<HTMLInputElement>, result: { itemId: number | string }) => {
                                        const matchedPlaybook = ansiblePlaybooks.filter((p) => p.path === result.itemId);
                                        if (matchedPlaybook[0]) {
                                            setCurrentPlaybook(matchedPlaybook[0]);
                                        }
                                    }
                                }
                                aria-label="Default global"
                                ouiaId="DefaultNav"
                            >
                                <NavList>
                                    {ansiblePlaybooks.map((p) =>
                                        <NavItem key={"nav-key-" + p.script_name} preventDefault id={"nav-default-link-" + p.path} to={"#nav-default-link-" + p.path} itemId={p.path} isActive={currentPlaybook?.path === p.path}>
                                            {p.script_name}{p.parent_playbook && " (Modified)"}
                                        </NavItem>)}
                                </NavList>
                            </Nav>
                        </GridItem>
                        <GridItem span={10}>
                            <Editor playbook={currentPlaybook} update_playbooks={getPlaybooks} />
                        </GridItem>
                    </Grid>
                </CardBody>
            </Card>
        </Page>
    );
};
