Feature: Lisk Accounts

  As a user
  I want to see details for my account
  So that I can validate my balance and other details

  Scenario: Ensure required accounts
    Given "thor" has a lisk account with balance 100 LSK tokens
    Given "loki" has a lisk account with balance 100 LSK tokens
    And "loki" has a account with second signature
    Given "odin" has a lisk account with balance 100 LSK tokens
    And "odin" has a account registered as delegate
    Given "heimdall" has a lisk account with balance 100 LSK tokens
    And "heimdall" creates a multisignature account with "thor", "odin"

  Scenario: List accounts
    When I look for list of accounts without any params
    Then I should get list of accounts sorted by "balance" in "asc" order
    When I search for a particular account "11237980039345381032L"
    Then I should get my account details

  Scenario Outline: List account
    When I look for list of account with "<params>"
    Then I should get account details according to "<params>"

    Examples:
      | params                                                                           |
      | address=11237980039345381032L                                                    |
      | publicKey=5c554d43301786aec29a09b13b485176e81d1532347a351aeafe018c199fd7ca       |
      | secondPublicKey=af365443121487c4935a33cd632ea6e6308a0e9b2e488de38a6a2e5aca96e8eb |
      | username=odin                                                                    |
      | limit=100                                                                        |
      | offset=2                                                                         |
      | sort=balance:asc                                                                 |
      | sort=balance:desc                                                                |

  Scenario: Searches multisignature groups for a specific address .
    When "heimdall" requests "multisignature_groups"
    Then "heimdall" should get "multisignature_groups" account

  Scenario: List all members belonging to a particular multisignature group.
    When "thor" and "odin" requests "multisignature_memberships" account
    Then "thor" and "odin" should get "multisignature_memberships" account
