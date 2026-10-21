import { expect, test } from '@playwright/test';
import { DEFAULT_CONFIG } from '@shared/constants';
import { LinkTargetModel, LinkType } from '@shared/models';
import { renderTemplateParts } from '@shared/services';

const PULL_REQUEST: LinkTargetModel = {
	type: LinkType.PullRequest,
	owner: 'react',
	repo: 'react',
	number: 9713,
	title: 'Fix number input value',
	url: 'https://github.com/react/react/pull/9713',
};

test('should split the default pull request template into link and text', () => {
	const parts = renderTemplateParts(
		DEFAULT_CONFIG.templates[LinkType.PullRequest],
		PULL_REQUEST
	);

	expect(parts).toEqual({
		before: '',
		link: 'PR 9713',
		after: ': Fix number input value',
	});
});
