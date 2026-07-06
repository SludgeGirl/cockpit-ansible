import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Grid, GridItem, Nav, NavItem, NavList, Page, PageSidebar } from '@patternfly/react-core';

import cockpit from 'cockpit';
import { Editor } from './components/code-editor';
import { Playbook } from './components/types';

const _ = cockpit.gettext;

export const Application = () => {
    const [ansiblePlaybooks, setAnsiblePlaybooks] = useState<Playbook[]>([]);
    const [currentPlaybook, setCurrentPlaybook] = useState<Playbook | null>(null);

    useEffect(() => {
        cockpit.spawn(["find", "/usr/share/ansible/playbooks", "-type", "f", "-name", "*.yaml"])
                .then((output): Promise<Playbook>[] => {
                    return output.split("\n").filter((v) => v !== "")
                            .map(async (playbook_path): Promise<Playbook> => {
                                const content = await cockpit.file(playbook_path).read();
                                return {
                                    path: playbook_path,
                                    script_name: playbook_path.split("/").reverse()[0],
                                    content,
                                    output: "",
                                };
                            });
                })
                .then((plays) => {
                    Promise.all(plays).then((playbooks) => {
                        playbooks.sort((a, b) => new Intl.Collator().compare(a.path, b.path));
                        setCurrentPlaybook(playbooks[0] || null);
                        setAnsiblePlaybooks(playbooks);
                    });
                });
    }, [setAnsiblePlaybooks]);

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
                                            {p.script_name}
                                        </NavItem>)}
                                </NavList>
                            </Nav>
                        </GridItem>
                        <GridItem span={10}>
                            <Editor playbook={currentPlaybook} />
                        </GridItem>
                    </Grid>
                </CardBody>
            </Card>
        </Page>
    );
};
